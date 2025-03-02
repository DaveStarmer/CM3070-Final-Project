"""Lambda Handler to copy Web Content
Code below is copied with fewer comments into the cloudfront stack, as copying files between
buckets in different regions
"""

import os
from pathlib import Path
import logging
import boto3
from crhelper import CfnResource


# Custom Resource helper
helper = CfnResource()

logger = logging.getLogger(__name__)


@helper.create
@helper.update
def copy_files(event: dict, _):
    """Copy files between buckets

    Args:
        event (dict): Lambda event
        _: context, not used
    """
    logger.debug("create/update process")
    # properties used by lambda
    props = event["ResourceProperties"]

    # region for source bucket
    source_region = props.get(
        "sourceRegion",
        os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION")),
    )
    logger.info("Source Region: %s", source_region)
    # region for destination bucket
    dest_region = props.get("destinationRegion", source_region)
    logger.info("Destination Region: %s", dest_region)

    # source code bucket
    source_bucket_name = props["sourceBucket"]
    # create s3 resource in correct region for source bucket
    s3_source = boto3.resource("s3")  # , region=source_region)
    # create bucket resource for source bucket
    source_bucket = s3_source.Bucket(source_bucket_name)
    logger.info("Source Bucket: %s", source_bucket_name)

    # destination code buckets
    dest_bucket_name = props["destinationBucket"]
    # create s3 resource in correct region for destination buckets
    s3_dest = boto3.resource("s3")  # , region=dest_region)
    # create bucket resources for public and private web buckets
    dest_bucket = s3_dest.Bucket(dest_bucket_name)
    logger.info("Destination Bucket: %s", dest_bucket_name)

    # iterate contents of source bucket, and copy contents across
    # without parent folder name
    keys = props["keys"]
    if isinstance(keys, str):
        keys = [keys]
    logger.debug("Keys: %s", ", ".join(props["keys"]))
    logger.debug(", ".join([x.key for x in source_bucket.objects.all()]))
    for key in keys:
        key_prefix = str(key)
        logger.debug("Checking for prefix: %s", key_prefix)
        for file in source_bucket.objects.filter(Prefix=key_prefix):
            logger.debug("Copying %s", file.key)
            source = {"Bucket": source_bucket_name, "Key": str(file.key)}
            new_key = Path(file.key).relative_to(key_prefix)
            # allow individual files to be passed through
            if new_key == "":
                new_key = Path(file).name
            dest_bucket.copy(source, str(new_key))
            logger.info("copied %s to %s", file.key, new_key)


@helper.delete
def no_op(_, __):
    """Function to execute on delete - performs no function"""
    logger.debug("delete process - no op")


def handler_function(event, context):
    """Lambda Function entry point

    Args:
        event (dict): AWS Lambda event
        context (AWS context): AWS Lambda context
    """
    logger.debug("File copy initiated")
    helper(event, context)
