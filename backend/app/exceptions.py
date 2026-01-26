"""
Application-specific exceptions
Structured error handling with codes and user messages
"""
from typing import Optional


class AppError(Exception):
    """Base application error"""
    
    def __init__(
        self,
        code: str,
        user_message: str,
        internal_details: str = "",
        http_status: int = 400,
    ):
        self.code = code
        self.user_message = user_message
        self.internal_details = internal_details
        self.http_status = http_status
        super().__init__(f"{code}: {user_message}")
    
    def to_dict(self):
        return {
            "code": self.code,
            "message": self.user_message,
        }


# ========== USER ERRORS ==========

class UserNotFoundError(AppError):
    def __init__(self, user_id: int):
        super().__init__(
            code="USER_NOT_FOUND",
            user_message="Пользователь не найден",
            internal_details=f"user_id={user_id}",
            http_status=404,
        )


class UserBannedError(AppError):
    def __init__(self):
        super().__init__(
            code="USER_BANNED",
            user_message="Ваш аккаунт заблокирован. Обратитесь в поддержку.",
            http_status=403,
        )


# ========== CREDIT ERRORS ==========

class InsufficientCreditsError(AppError):
    def __init__(self, required: int, available: int):
        super().__init__(
            code="INSUFFICIENT_CREDITS",
            user_message=f"Недостаточно кредитов. Нужно {required} 💎, доступно {available} 💎",
            internal_details=f"required={required}, available={available}",
            http_status=402,  # Payment Required
        )


class ConcurrentUpdateError(AppError):
    def __init__(self):
        super().__init__(
            code="CONCURRENT_UPDATE",
            user_message="Попробуйте ещё раз через секунду",
            internal_details="Race condition detected",
            http_status=409,  # Conflict
        )


# ========== LIMIT ERRORS ==========

class RateLimitError(AppError):
    def __init__(self, retry_after: int = 60):
        super().__init__(
            code="RATE_LIMIT_EXCEEDED",
            user_message=f"Слишком много запросов. Подождите {retry_after} сек.",
            internal_details=f"retry_after={retry_after}",
            http_status=429,  # Too Many Requests
        )


class MaxActiveGenerationsError(AppError):
    def __init__(self, max_allowed: int):
        super().__init__(
            code="MAX_ACTIVE_GENERATIONS",
            user_message=f"Максимум {max_allowed} активных генераций. Дождитесь завершения.",
            internal_details=f"max={max_allowed}",
            http_status=409,  # Conflict
        )


# ========== GENERATION ERRORS ==========

class GenerationNotFoundError(AppError):
    def __init__(self, generation_id: int):
        super().__init__(
            code="GENERATION_NOT_FOUND",
            user_message="Генерация не найдена",
            internal_details=f"generation_id={generation_id}",
            http_status=404,
        )


class ModelUnavailableError(AppError):
    def __init__(self, model_id: str):
        super().__init__(
            code="MODEL_UNAVAILABLE",
            user_message="Модель временно недоступна. Попробуйте другую.",
            internal_details=f"model={model_id}",
            http_status=503,  # Service Unavailable
        )


class GenerationTimeoutError(AppError):
    def __init__(self, timeout_seconds: int):
        super().__init__(
            code="GENERATION_TIMEOUT",
            user_message=f"Генерация превысила лимит времени ({timeout_seconds}s). Кредиты возвращены.",
            internal_details=f"timeout={timeout_seconds}",
            http_status=504,  # Gateway Timeout
        )


class DuplicateRequestError(AppError):
    def __init__(self):
        super().__init__(
            code="DUPLICATE_REQUEST",
            user_message="Этот запрос уже обрабатывается",
            http_status=409,  # Conflict
        )


# ========== PAYMENT ERRORS ==========

class InsufficientBalanceError(AppError):
    def __init__(self, required: int, available: int):
        super().__init__(
            code="INSUFFICIENT_BALANCE",
            user_message=f"Недостаточно средств для вывода. Доступно: {available:,} UZS",
            internal_details=f"required={required}, available={available}",
            http_status=402,
        )


class MinimumWithdrawalError(AppError):
    def __init__(self, minimum: int):
        super().__init__(
            code="MINIMUM_WITHDRAWAL",
            user_message=f"Минимальная сумма вывода: {minimum:,} UZS",
            internal_details=f"min={minimum}",
            http_status=400,
        )
