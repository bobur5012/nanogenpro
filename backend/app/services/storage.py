"""
S3-compatible storage service for image uploads.
"""
import base64
import uuid
from typing import Tuple, Optional

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings
import structlog

logger = structlog.get_logger()


ALLOWED_IMAGE_TYPES = {
    "png": "image/png",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "webp": "image/webp",
}


class StorageUploadError(Exception):
    pass


class StorageService:
    def __init__(self):
        self.bucket = settings.storage_bucket_name
        self.s3 = boto3.client(
            "s3",
            endpoint_url=settings.storage_endpoint_url,
            region_name=settings.storage_region,
            aws_access_key_id=settings.storage_access_key_id,
            aws_secret_access_key=settings.storage_secret_access_key,
            config=BotoConfig(s3={"addressing_style": "path"}),
        )

    def _validate_image_bytes(self, image_bytes: bytes) -> str:
        max_size = settings.max_image_upload_mb * 1024 * 1024
        if len(image_bytes) > max_size:
            raise StorageUploadError(f"Image exceeds {settings.max_image_upload_mb}MB limit")

        # Check signature manually (imghdr removed in Py3.13)
        img_type = None
        if image_bytes.startswith(b'\xff\xd8\xff'):
            img_type = "jpeg"
        elif image_bytes.startswith(b'\x89PNG\r\n\x1a\n'):
            img_type = "png"
        elif image_bytes.startswith(b'RIFF') and image_bytes[8:12] == b'WEBP':
            img_type = "webp"

        if img_type == "jpeg":
            ext = "jpg"
        else:
            ext = img_type

        if not ext or ext not in ALLOWED_IMAGE_TYPES:
            raise StorageUploadError("Unsupported image type. Use png/jpg/jpeg/webp.")
        return ext

    def _decode_base64_image(self, data: str) -> Tuple[bytes, str]:
        """
        Decode base64 image and return bytes + file extension.
        Accepts data URL or raw base64.
        """
        raw_data = data
        if data.startswith("data:image"):
            raw_data = data.split(",", 1)[1] if "," in data else data

        try:
            image_bytes = base64.b64decode(raw_data)
        except Exception as e:
            raise StorageUploadError("Invalid base64 image data") from e

        ext = self._validate_image_bytes(image_bytes)
        return image_bytes, ext

    def upload_image_bytes(self, image_bytes: bytes, prefix: str) -> str:
        """
        Upload raw image bytes to storage and return URL.
        """
        ext = self._validate_image_bytes(image_bytes)
        key = f"{prefix}/{uuid.uuid4().hex}.{ext}"
        content_type = ALLOWED_IMAGE_TYPES[ext]
        self._put_object(key, image_bytes, content_type)
        return self._build_public_url(key)

    def _build_public_url(self, key: str) -> str:
        if settings.storage_public_base_url:
            return f"{settings.storage_public_base_url.rstrip('/')}/{key}"
        try:
            return self.s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=settings.storage_signed_url_expires,
            )
        except Exception as e:
            raise StorageUploadError("Failed to generate signed URL") from e

    def upload_base64_image(self, data: str, prefix: str) -> str:
        """
        Upload image to S3-compatible storage and return URL.
        """
        image_bytes, ext = self._decode_base64_image(data)
        key = f"{prefix}/{uuid.uuid4().hex}.{ext}"
        content_type = ALLOWED_IMAGE_TYPES[ext]
        self._put_object(key, image_bytes, content_type)
        return self._build_public_url(key)

    def _put_object(self, key: str, body: bytes, content_type: str) -> None:
        if not self.bucket: 
            # If no bucket configured, fail gracefully or skip (based on config optionality)
            # But since upload was called, we expect it to work.
            raise StorageUploadError("Storage bucket not configured")
            
        try:
            put_params = {
                "Bucket": self.bucket,
                "Key": key,
                "Body": body,
                "ContentType": content_type,
            }
            # Only set ACL if not using a private bucket policy that forbids it.
            # Usually S3 compatible storage supports public-read if configured.
            if settings.storage_public_base_url:
                put_params["ACL"] = "public-read"
            self.s3.put_object(**put_params)
        except (BotoCoreError, ClientError) as e:
            logger.error("Storage upload failed", error=str(e), key=key)
            raise StorageUploadError("Storage upload failed") from e


storage_service = StorageService()
