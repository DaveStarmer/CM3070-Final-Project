"""Module for generating presigned URLs

Raises:
    RuntimeError: no URL returned

Returns:
    string: Presigned URL
"""

import logging
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


def generate_presigned_url(bucket: str, key: str, operation: str, lifetime: int) -> str:
    """
    Generate a presigned Amazon S3 URL that can be used to perform an action.

    Args:
        bucket: name of bucket
        key: key of object (filename)
        operation: 'get_object' for get or 'put_object' for put
        lifetime: number of seconds presigned URL remains valid for

    Returns
        A presigned URL with the appropriate lifetime
    """
    # correct names of methods, in case of straight-forward errors
    operation = operation.lower()  # lower case
    if operation == "get":
        operation = "get_object"
    if operation == "put":
        operation = "put_object"

    # validate appropriate client_method, log and raise error if wrong
    if operation not in ["get_object", "put_object"]:
        logger.error("%s is not a recognised client method", operation)
        raise RuntimeError(f"Inappropriate client_method ({operation})")

    # generate s3 client in function (change from original function)
    s3_client = boto3.client("s3")

    # in try-catch block to clearly log issue
    try:
        url = s3_client.generate_presigned_url(
            ClientMethod=operation,
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=lifetime,
        )
        logger.info("Got presigned URL: %s", url)
    except ClientError:
        logger.exception(
            "Couldn't get a presigned URL for client method '%s'.", operation
        )
        raise
    return url
