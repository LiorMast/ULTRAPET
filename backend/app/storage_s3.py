"""storage_s3.py — The S3 driver of the file storage (app/storage.py picks it when STORAGE_BACKEND=s3): the objects
of one bucket through boto3. Callers never use it directly; they call storage.put_object, get_object, ... Its tests
run against moto's fake S3 (backend/tests/test_storage.py), so no AWS account is needed.
"""
from typing import Any

import boto3
from botocore.exceptions import ClientError

from app.storage import CACHE_CONTROL


class S3Storage:
    """The S3 driver: the objects of one bucket, through a boto3 client (thread-safe, made once per settings)."""

    def __init__(self, bucket: str, region: str, endpoint_url: str | None = None) -> None:
        """Creates the client.

        Args:
            bucket: S3_BUCKET.
            region: S3_REGION.
            endpoint_url: S3_ENDPOINT_URL for an S3-compatible service; None = AWS.
        """
        self.bucket = bucket
        self.client = boto3.client("s3", region_name=region, endpoint_url=endpoint_url or None)

    @staticmethod
    def missing(error: Exception) -> bool:
        """Whether a boto3 error means "no such object".

        Args:
            error: A botocore ClientError.

        Returns:
            True for a 404 / NoSuchKey / NotFound.
        """
        response: dict[str, Any] = getattr(error, "response", {}) or {}
        code = str(response.get("Error", {}).get("Code", ""))
        return code in ("404", "NoSuchKey", "NotFound")

    def put(self, key: str, body: bytes, content_type: str) -> None:
        """Stores an object (PutObject), with its media type and a year-long immutable cache.

        Args:
            key: The object key.
            body: The file's bytes.
            content_type: Its media type, e.g. "image/png".
        """
        self.client.put_object(Bucket=self.bucket, Key=key, Body=body, ContentType=content_type, CacheControl=CACHE_CONTROL)

    def get(self, key: str) -> bytes | None:
        """Reads an object (GetObject).

        Args:
            key: The object key.

        Returns:
            Its bytes; None when there is no such object.

        Raises:
            botocore.exceptions.ClientError: Any other failure (access denied, ...).
        """
        try:
            return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        except ClientError as error:
            if self.missing(error):
                return None
            raise

    def exists(self, key: str) -> bool:
        """Whether an object exists (HeadObject).

        Args:
            key: The object key.

        Returns:
            True when it does.

        Raises:
            botocore.exceptions.ClientError: Any other failure than a 404.
        """
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
        except ClientError as error:
            if self.missing(error):
                return False
            raise
        return True

    def delete(self, key: str) -> None:
        """Deletes an object (DeleteObject; S3 answers a missing key the same way).

        Args:
            key: The object key.
        """
        self.client.delete_object(Bucket=self.bucket, Key=key)
