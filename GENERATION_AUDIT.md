# 🔍 АУДИТ СИСТЕМЫ ГЕНЕРАЦИИ - NanoGen Backend

**Дата:** 2026-01-26  
**Версия:** 1.0  
**Статус сервера:** ✅ Работает (все import errors исправлены)

---

## 📊 EXECUTIVE SUMMARY

| # | Проблема | Критичность | Статус |
|---|----------|-------------|--------|
| 1 | Race condition при списании кредитов | 🔴 КРИТИЧЕСКАЯ | Требует исправления |
| 2 | Нет идемпотентности запросов | 🔴 КРИТИЧЕСКАЯ | Требует исправления |
| 3 | Отсутствуют лимиты (DoS уязвимость) | 🔴 ВЫСОКАЯ | Требует исправления |
| 4 | Background task может потерять данные | 🟡 ВЫСОКАЯ | Требует исправления |
| 5 | Неправильная логика списания (до API call) | 🟡 СРЕДНЯЯ | Рекомендуется |
| 6 | Нет структурированных ошибок | 🟡 СРЕДНЯЯ | Рекомендуется |
| 7 | Противоречивые статусы (FAILED+REFUNDED) | 🟡 СРЕДНЯЯ | Рекомендуется |
| 8 | Tight coupling с Telegram | 🟢 НИЗКАЯ | Опционально |

---

## 🚨 КРИТИЧЕСКАЯ ПРОБЛЕМА №1: Race Condition

### Описание

**Файл:** `app/services/generation.py:87-90`

```python
# ❌ НЕ АТОМАРНО!
user.credits -= price                    # READ-MODIFY-WRITE
user.total_spent_credits += price        # Между операциями могут пройти другие запросы
user.total_generations += 1
```

### Сценарий эксплуатации

```
Баланс пользователя: 100 💎

┌─────────────┬─────────────┐
│  Request 1  │  Request 2  │
├─────────────┼─────────────┤
│ reads: 100  │             │
│             │ reads: 100  │ ← Оба прочитали одинаковое значение!
│ writes: 80  │             │
│             │ writes: 80  │ ← Оба записали одинаковое значение!
└─────────────┴─────────────┘

Результат: Баланс 80, но потрачено 40 💎
Потеря: 20 💎 (revenue loss!)
```

### Исправление

**Используйте атомарный UPDATE с проверкой:**

```python
from sqlalchemy import update

stmt = (
    update(User)
    .where(
        User.id == user_id,
        User.credits >= price,  # ← CRITICAL: ensure balance sufficient
    )
    .values(
        credits=User.credits - price,
        total_spent_credits=User.total_spent_credits + price,
        total_generations=User.total_generations + 1,
        last_active_at=datetime.utcnow(),
    )
    .returning(User.credits)
)

result = await db.execute(stmt)
new_balance = result.scalar_one_or_none()

if new_balance is None:
    # Balance insufficient or concurrent update
    raise ConcurrentUpdateError()
```

**Почему это работает:**
- Операция выполняется на уровне БД (атомарно)
- WHERE clause гарантирует, что баланс достаточен в момент UPDATE
- Если 2 запроса придут одновременно, второй получит `new_balance = None`

---

## 🚨 КРИТИЧЕСКАЯ ПРОБЛЕМА №2: Нет идемпотентности

### Описание

Пользователь нажал кнопку "Создать" 2 раза → создаются 2 генерации, списываются кредиты дважды.

**Frontend:** Кнопка не блокируется после клика  
**Backend:** Нет проверки на дубликаты

### Исправление

#### Backend

**1. Добавить поле в модель Generation:**

```python
class Generation(Base):
    # ...
    idempotency_key = Column(String(64), nullable=True, index=True)
```

**2. Проверка в start_generation:**

```python
if request.idempotency_key:
    existing = await db.scalar(
        select(Generation.id).where(
            Generation.user_id == request.user_id,
            Generation.idempotency_key == request.idempotency_key,
        )
    )
    if existing:
        raise DuplicateRequestError()  # HTTP 409
```

#### Frontend

```typescript
const [isSubmitting, setIsSubmitting] = useState(false);
const idempotencyKey = useRef(crypto.randomUUID());

const handleSubmit = async () => {
  if (isSubmitting) return; // ✅ Защита от повторного клика
  setIsSubmitting(true);
  
  try {
    await api.post('/generation/start', {
      ...payload,
      idempotency_key: idempotencyKey.current,
    });
  } finally {
    setIsSubmitting(false);
  }
};
```

---

## 🚨 КРИТИЧЕСКАЯ ПРОБЛЕМА №3: Отсутствуют лимиты

### Описание

**Уязвимости:**
1. Пользователь может запустить 1000 генераций → выжечь весь баланс
2. Спам запросов → DoS атака
3. Нет ограничений на тяжёлые модели

**Текущее состояние:** Лимитов нет вообще.

### Исправление

```python
# Константы
MAX_ACTIVE_GENERATIONS = 5       # Max concurrent
RATE_LIMIT_PER_MINUTE = 10       # Max per minute
RATE_LIMIT_PREMIUM = 30          # For premium users

async def check_limits(self, db: AsyncSession, user_id: int, is_premium: bool = False):
    """Check all limits before allowing generation"""
    
    # 1. Active generations limit
    active_count = await db.scalar(
        select(func.count(Generation.id)).where(
            Generation.user_id == user_id,
            Generation.status.in_([
                GenerationStatus.PENDING,
                GenerationStatus.PROCESSING,
            ]),
        )
    )
    
    if active_count >= MAX_ACTIVE_GENERATIONS:
        raise MaxActiveGenerationsError(MAX_ACTIVE_GENERATIONS)
    
    # 2. Rate limit (per minute)
    one_minute_ago = datetime.utcnow() - timedelta(minutes=1)
    recent_count = await db.scalar(
        select(func.count(Generation.id)).where(
            Generation.user_id == user_id,
            Generation.created_at >= one_minute_ago,
        )
    )
    
    limit = RATE_LIMIT_PREMIUM if is_premium else RATE_LIMIT_PER_MINUTE
    if recent_count >= limit:
        raise RateLimitError(retry_after=60)
```

**Где вызывать:**  
В `start_generation` перед списанием кредитов (строка 72).

---

## 🟡 ВЫСОКАЯ ПРОБЛЕМА №4: Background task fallback

### Описание

**Файл:** `api/generation.py:56-68`

```python
async def process_generation_background(generation_id: int):
    async with AsyncSessionLocal() as db:
        try:
            await generation_service.process_generation(db, generation_id)
        except Exception as e:
            logger.error(...)  # ❌ И ВСЁ! Данные потеряны
```

**Что может пойти не так:**
- Out of memory → task killed
- Container restart
- Timeout на уровне Railway
- Python exception (bug)

**Результат:**  
Generation остаётся в `PROCESSING` навсегда, кредиты потеряны.

### Исправление

```python
async def process_generation_background(generation_id: int):
    """Process generation with fallback refund protection"""
    async with AsyncSessionLocal() as db:
        try:
            # Use callback pattern for notifications
            await generation_service.process_generation(
                db,
                generation_id,
                on_started=lambda **kw: telegram_service.send_generation_started(**kw),
                on_completed=lambda **kw: telegram_service.send_generation_result(**kw),
                on_failed=lambda **kw: telegram_service.send_generation_error(**kw),
            )
        except Exception as e:
            logger.error(
                "Background task crashed",
                generation_id=generation_id,
                error=str(e),
                error_type=type(e).__name__,
            )
            
            # ✅ FALLBACK: Refund credits
            try:
                async with AsyncSessionLocal() as fallback_db:
                    gen = await fallback_db.get(Generation, generation_id)
                    if gen and gen.status in [GenerationStatus.PENDING, GenerationStatus.PROCESSING]:
                        gen.status = GenerationStatus.FAILED
                        gen.error_message = "Internal server error"
                        gen.completed_at = datetime.utcnow()
                        
                        # Refund
                        user = await fallback_db.get(User, gen.user_id)
                        if user:
                            user.credits += gen.credits_charged
                            
                            refund = Transaction(
                                user_id=user.id,
                                type=TransactionType.REFUND,
                                amount=gen.credits_charged,
                                reference_id=generation_id,
                                description=f"Emergency refund for crashed generation #{generation_id}",
                            )
                            fallback_db.add(refund)
                        
                        await fallback_db.commit()
                        
                        # Try to notify user
                        try:
                            await telegram_service.send_generation_error(
                                user_id=gen.user_id,
                                model_name=gen.model_name,
                                error_message="Внутренняя ошибка сервера. Кредиты возвращены.",
                                error_code="INTERNAL_ERROR",
                                credits_refunded=gen.credits_charged,
                            )
                        except:
                            pass  # Notification is not critical
                            
            except Exception as fallback_error:
                logger.critical(
                    "CRITICAL: Fallback refund failed!",
                    generation_id=generation_id,
                    error=str(fallback_error),
                )
                # TODO: Send alert to admin channel
```

---

## 🟡 СРЕДНЯЯ ПРОБЛЕМА №5: Противоречивые статусы

### Описание

**Файл:** `generation.py:250, 269`

```python
generation.status = GenerationStatus.FAILED  # Line 250
# ... refund logic ...
generation.status = GenerationStatus.REFUNDED  # Line 269 ← Перезаписывает!
```

**Проблема:**  
- Невозможно отличить "failed without refund" от "failed with refund"
- Статус меняется дважды в одной транзакции

### Решение А: Убрать REFUNDED

```python
class GenerationStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    # REFUNDED - удалить!
```

**Логика:** FAILED всегда означает возврат кредитов.

### Решение Б: Добавить boolean поле

```python
# В модели Generation
is_refunded = Column(Boolean, default=False)

# В логике
generation.status = GenerationStatus.FAILED
generation.is_refunded = True  # ✅ Явно указываем
```

**Рекомендую:** Решение А (проще и чище).

---

## 🟡 СРЕДНЯЯ ПРОБЛЕМА №6: Нет структурированных ошибок

### Текущее состояние

```python
raise ValueError("User not found")              # ❌ Generic
raise ValueError("Insufficient balance...")     # ❌ Разный формат
raise HTTPException(status_code=400, detail=str(e))  # ❌ Нет кода
```

**Проблемы:**
- Frontend не может различить типы ошибок
- Нет error codes для аналитики
- Нельзя локализовать сообщения

### Решение

**1. Создан файл `app/exceptions.py`** (см. выше)

**2. Использование в сервисах:**

```python
from app.exceptions import (
    UserNotFoundError,
    InsufficientCreditsError,
    RateLimitError,
)

# В start_generation
if not user:
    raise UserNotFoundError(request.user_id)

if user.credits < price:
    raise InsufficientCreditsError(required=price, available=user.credits)
```

**3. Обработка в API:**

```python
from app.exceptions import AppError

@router.post("/start")
async def start_generation(...):
    try:
        result = await generation_service.start_generation(...)
        return result
    except AppError as e:
        raise HTTPException(
            status_code=e.http_status,
            detail={
                "code": e.code,
                "message": e.user_message,
            }
        )
    except Exception as e:
        logger.error("Unexpected error", error=str(e))
        raise HTTPException(
            status_code=500,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "Внутренняя ошибка сервера",
            }
        )
```

**4. Frontend обработка:**

```typescript
try {
  await api.post('/generation/start', payload);
} catch (error) {
  if (error.response?.data?.code === 'INSUFFICIENT_CREDITS') {
    navigate('/payment'); // Redirect to payment
  } else if (error.response?.data?.code === 'RATE_LIMIT_EXCEEDED') {
    showNotification(error.response.data.message, 'warning');
  } else {
    showNotification('Ошибка генерации', 'error');
  }
}
```

---

## 📋 ДЕТАЛЬНЫЙ АНАЛИЗ ПО ПУНКТАМ

### 1️⃣ API ГЕНЕРАЦИИ

#### `/api/generation/start`

| Проверка | Статус | Комментарий |
|----------|--------|-------------|
| HTTP метод (POST) | ✅ | Правильно |
| Валидация входных данных | ✅ | Через Pydantic |
| Идемпотентность | ❌ | **Отсутствует** |
| Защита от повторного клика | ❌ | **Отсутствует** |
| HTTP коды ответов | 🟡 | 400 для всех ошибок (нужно 402, 409, 429) |
| init_data проверка | ❌ | TODO (строка 35) |

**Рекомендации:**
- Добавить `idempotency_key` в request
- Вернуть правильные HTTP коды (402, 409, 429)
- Реализовать проверку `init_data` (защита от подделки)

---

### 2️⃣ FLOW ГЕНЕРАЦИИ

#### Текущий flow

```
1. Request → API endpoint
2. ✅ Проверка user (exists, not banned)
3. ✅ Проверка баланса
4. ❌ СПИСАНИЕ КРЕДИТОВ (должен быть резерв!)
5. ✅ Создание Generation (PENDING)
6. ✅ Создание Transaction (audit)
7. ✅ Background task
8. ✅ PROCESSING status
9. ✅ AIML API call
10. ✅ COMPLETED / FAILED
11. ✅ Telegram notification
```

#### Проблемы в текущем flow

| Шаг | Проблема | Критичность |
|-----|----------|-------------|
| 3 | Нет проверки лимитов | 🔴 Критическая |
| 4 | Списание ДО API call (не резерв) | 🟡 Средняя |
| 4 | Race condition | 🔴 **Критическая** |
| 7 | Background task может упасть | 🟡 Высокая |

#### Рекомендуемый улучшенный flow

```
1. Request → API endpoint
2. ✅ Проверка user
3. ✅ Проверка лимитов (NEW!)
4. ✅ Проверка идемпотентности (NEW!)
5. ✅ АТОМАРНОЕ списание кредитов (FIXED!)
6. ✅ Создание Generation + Transaction
7. ✅ Commit БД
8. ✅ Return response (быстро!)
9. Background: PROCESSING
10. Background: AIML API call
11. Background: COMPLETED/FAILED
12. Background: Telegram notification
13. Fallback: Emergency refund (NEW!)
```

---

### 3️⃣ СТАТУСЫ ГЕНЕРАЦИИ

#### Текущие статусы (models/generation.py)

```python
class GenerationStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"  # ← ⚠️ Противоречит FAILED
```

#### Оценка

| Аспект | Статус | Комментарий |
|--------|--------|-------------|
| Enum определён | ✅ | В models, правильно |
| Статусы меняются в одном месте | ✅ | Только в service |
| Нет изменений в контроллерах | ✅ | Правильно |
| REFUNDED противоречит FAILED | ❌ | Нужно убрать |
| Нет CANCELLED статуса | ❌ | Нужно для отмены |

#### Рекомендуемые статусы

```python
class GenerationStatus(str, enum.Enum):
    PENDING = "pending"         # Created, waiting for background processing
    PROCESSING = "processing"   # Background task started
    COMPLETED = "completed"     # Success
    FAILED = "failed"           # Failed (credits auto-refunded)
    CANCELLED = "cancelled"     # User cancelled (credits refunded)
```

**Дополнительно:**  
Добавить boolean поле `is_refunded` для явного трекинга возвратов (опционально).

---

### 4️⃣ КРЕДИТЫ И АТОМАРНОСТЬ

#### Проблемы

1. **Race condition** (см. Критическая проблема №1)
2. **Неправильная логика списания:**
   - Кредиты списываются ДО вызова AIML API
   - Если API недоступен → пользователь видит уменьшенный баланс 3+ минуты
   - Потом возврат → confusing UX

#### Рекомендации

**Вариант А: Резервирование (сложно, но правильно)**

```python
# 1. Резерв
transaction = Transaction(
    user_id=user_id,
    type=TransactionType.GENERATION_RESERVE,
    amount=-price,
    status="reserved",  # ← NEW status
)

# 2. API call

# 3. Success → convert reserve to charge
transaction.status = "charged"

# 4. Failure → convert reserve to refund
transaction.status = "refunded"
```

**Вариант Б: Текущая логика, но улучшенная**

```python
# 1. Atomic deduction (fixed race condition)
# 2. Immediate API call validation (не ждать 3 минуты!)
# 3. Quick fail → quick refund
# 4. Long polling в background

# Быстрая проверка доступности API:
try:
    await aiml_client.health_check()  # ← Добавить метод
except:
    # API unavailable → refund immediately
    user.credits += price
    raise ModelUnavailableError(request.model_id)
```

**Рекомендую:** Вариант Б (проще, без изменения архитектуры).

---

### 5️⃣ ЛИМИТЫ И ОГРАНИЧЕНИЯ

| Лимит | Текущее | Рекомендуемое |
|-------|---------|---------------|
| Max активных генераций | ❌ Нет | ✅ 5 (обычные), 10 (premium) |
| Rate limit (минутный) | ❌ Нет | ✅ 10/min (обычные), 30/min (premium) |
| Лимит по модели | ❌ Нет | 🟡 Опционально (для дорогих моделей) |
| Таймаут генерации | 🟡 600s (в aiml_client) | ✅ 600s (достаточно) |

**Реализация:** См. Критическая проблема №3.

---

### 6️⃣ ОШИБКИ И УВЕДОМЛЕНИЯ

#### Текущая система ошибок

```python
# ❌ Проблемы:
raise ValueError("User not found")           # Generic string
raise Exception("No task_id in response")    # No structure
return {"detail": str(e)}                    # No error code
```

#### Рекомендуемая структура

**Создан файл `app/exceptions.py`** с иерархией:

```
AppError (базовый)
├── UserNotFoundError
├── UserBannedError
├── InsufficientCreditsError
├── ConcurrentUpdateError
├── RateLimitError
├── MaxActiveGenerationsError
├── GenerationNotFoundError
├── ModelUnavailableError
└── GenerationTimeoutError
```

**Каждая ошибка содержит:**
- `code` - для программной обработки
- `user_message` - для отображения пользователю
- `internal_details` - для логов
- `http_status` - правильный HTTP код

---

### 7️⃣ TELEGRAM ИНТЕГРАЦИЯ

#### Оценка

| Аспект | Статус | Комментарий |
|--------|--------|-------------|
| Telegram НЕ блокирует генерацию | ✅ | Async вызовы |
| Отправка асинхронная | ✅ | Через `await` |
| Падение Telegram не ломает логику | ✅ | Try-catch в service |
| Отправляются все статусы | ✅ | Started, completed, error |

#### Архитектурная проблема (низкий приоритет)

**Tight coupling:**  
`generation_service` напрямую вызывает `telegram_service`.

**Правильнее:**  
Event-driven или callback pattern (уже реализовано в `generation_improved.py`).

```python
# ✅ Callback pattern (decoupled)
await generation_service.process_generation(
    db,
    generation_id,
    on_completed=lambda **kw: telegram_service.send_result(**kw),
)
```

---

### 8️⃣ ЛОГИРОВАНИЕ И АУДИТ

#### Текущее логирование

✅ **Хорошо:**
- Структурированное логирование (structlog)
- Логируются: start, completion, error
- Включены: user_id, generation_id, model, price

❌ **Отсутствует:**
- Audit trail для админки
- Изменения статусов не логируются
- Нет метрик (duration, success rate)

#### Рекомендации

**Добавить детальное логирование статусов:**

```python
def _log_status_change(
    self,
    generation: Generation,
    old_status: GenerationStatus,
    new_status: GenerationStatus,
    reason: str = "",
):
    """Log every status change for audit"""
    logger.info(
        "Generation status changed",
        generation_id=generation.id,
        user_id=generation.user_id,
        old_status=old_status.value,
        new_status=new_status.value,
        reason=reason,
        timestamp=datetime.utcnow().isoformat(),
    )

# Использование
old_status = generation.status
generation.status = GenerationStatus.PROCESSING
self._log_status_change(generation, old_status, GenerationStatus.PROCESSING, "API call started")
```

**Метрики для админки:**

```python
# Добавить в модель Generation
duration_seconds = Column(Integer, nullable=True)  # completion_time - start_time
```

---

### 9️⃣ ТИПОВЫЕ АРХИТЕКТУРНЫЕ ПРОБЛЕМЫ

#### Найденные проблемы

| Проблема | Где | Решение |
|----------|-----|---------|
| Circular imports | ❌ Нет | ✅ Хорошо |
| Дублирующая логика | `balance_service` vs `generation_service` | Консолидировать |
| Бизнес-логика в API | ❌ Нет | ✅ Всё в services |
| Отсутствие транзакций БД | Некоторые операции | Добавить `async with db.begin()` |
| Прямые вызовы Telegram | ✅ Да, в service | Использовать callbacks |

---

## 🎯 ПЛАН РЕФАКТОРИНГА (приоритеты)

### Этап 1: Критические исправления (СЕЙЧАС)

1. ✅ **Исправить race condition**
   - Atomic UPDATE вместо READ-MODIFY-WRITE
   - Файл: `generation.py:87-90`

2. ✅ **Добавить идемпотентность**
   - Миграция: `idempotency_key` в Generation
   - Проверка дубликатов
   - Frontend: disabled кнопка + UUID

3. ✅ **Добавить лимиты**
   - MAX_ACTIVE_GENERATIONS
   - RATE_LIMIT_PER_MINUTE
   - Проверка в `start_generation`

4. ✅ **Fallback для background task**
   - Try-catch с emergency refund
   - Critical logging

### Этап 2: Важные улучшения (СЛЕДУЮЩИЙ)

5. **Структурированные ошибки**
   - Использовать `app/exceptions.py`
   - Обновить все `raise ValueError`

6. **Убрать REFUNDED статус**
   - Упростить логику
   - FAILED = всегда refunded

7. **Callback pattern для Telegram**
   - Decoupling
   - Тестируемость

### Этап 3: Оптимизации (ПОТОМ)

8. Резервирование кредитов (вместо immediate deduction)
9. Метрики и аналитика
10. Admin dashboard готовность

---

## 📂 СОЗДАННЫЕ ФАЙЛЫ

1. **`app/exceptions.py`** - Структурированные исключения
2. **`app/services/generation_improved.py`** - Улучшенная версия с исправлениями
3. **`alembic/versions/003_generation_improvements.py`** - Миграция для idempotency
4. **`GENERATION_AUDIT.md`** (этот файл) - Полный отчёт

---

## ✅ ЧЕКЛИСТ ПРИМЕНЕНИЯ ИСПРАВЛЕНИЙ

### Шаг 1: Применить критические исправления

```bash
# 1. Заменить текущий generation_service
cp app/services/generation_improved.py app/services/generation.py

# 2. Обновить модель Generation
# Добавить в app/models/generation.py:
#   idempotency_key = Column(String(64), nullable=True, index=True)
#   timeout_at = Column(DateTime(timezone=True), nullable=True)

# 3. Обновить GenerationStatus enum
# Убрать REFUNDED, добавить CANCELLED

# 4. Запустить миграцию
alembic upgrade head

# 5. Обновить API endpoint
# Использовать новые exceptions и callbacks
```

### Шаг 2: Тестирование

```python
# Test 1: Concurrent requests (race condition)
async def test_concurrent_generations():
    tasks = [
        generation_service.start_generation(db, request)
        for _ in range(10)  # 10 одновременных запросов
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Expected: 5 успешных, 5 с MaxActiveGenerationsError
    # Balance должен уменьшиться ровно на (5 * price)

# Test 2: Idempotency
async def test_idempotency():
    key = "test-key-123"
    result1 = await generation_service.start_generation(db, request, key)
    result2 = await generation_service.start_generation(db, request, key)
    
    # Expected: result2 raises DuplicateRequestError
    # Only 1 generation created

# Test 3: Rate limit
async def test_rate_limit():
    for i in range(15):
        await generation_service.start_generation(db, request)
    
    # Expected: First 10 succeed, 11+ raise RateLimitError
```

---

## 🎓 ПОЧЕМУ ЭТИ ИЗМЕНЕНИЯ ВАЖНЫ

### 1. Race condition → Revenue loss

Без атомарности вы **теряете деньги**:
- 1000 пользователей × 20 💎 потерь/день = **20,000 💎/день**
- При цене 500 UZS/💎 = **10,000,000 UZS/день потерь**

### 2. Отсутствие лимитов → DoS атака

Один злоумышленник может:
- Выжечь все кредиты за секунду
- Создать 1000+ pending генераций
- Заблокировать AIML API quota
- Заблокировать БД

### 3. Нет идемпотентности → Double charging

Плохой интернет у пользователя:
- Нажал "Создать"
- Подождал 5 сек, нажал ещё раз
- Списалось 2×price
- Жалоба в поддержку, возврат, репутация

### 4. Background task падает → Data loss

Container restart на Railway:
- 50 активных генераций
- Restart → все tasks killed
- 50 × 15 💎 = 750 💎 потеряны
- 50 пользователей недовольны

---

## 🚀 СЛЕДУЮЩИЕ ШАГИ

### Сейчас (для быстрого старта):

1. **Запустите миграцию БД:**
   ```bash
   alembic upgrade head
   ```

2. **Примените МИНИМАЛЬНЫЕ исправления:**
   - Atomic UPDATE для кредитов (10 строк кода)
   - Добавить check_limits (30 строк)
   - Fallback в background task (20 строк)

3. **Протестируйте на Railway**

### Потом (полный рефакторинг):

4. Заменить `generation.py` на `generation_improved.py`
5. Добавить `exceptions.py` в проект
6. Обновить API endpoints (использовать новые exceptions)
7. Обновить Frontend (idempotency keys, disabled кнопки)

---

## 📞 ГОТОВ ПОМОЧЬ

Скажите, какой подход выбираете:

**А)** Применить ВСЕ исправления сейчас (recommended)  
**Б)** Только критические (race condition + limits)  
**В)** Показать diff построчно для каждого файла

**Я готов:**
- Применить изменения в текущие файлы
- Обновить модели и миграции
- Обновить API endpoints
- Написать тесты
