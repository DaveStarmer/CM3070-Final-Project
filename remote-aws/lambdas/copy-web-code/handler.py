"""Lambda Handler to copy Web Content
Code below is copied with fewer comments into the cloudfront stack, as copying files between
buckets in different regions
"""

import os
from pathlib import Path
import boto3
from crhelper import CfnResource
import logging

# intialise logging
logger = logging.getLogger(__name__)

# Custom Resource helper
helper = CfnResource()


@helper.create
@helper.update
def copy_files(event: dict, _):
    """Copy files between buckets

    Args:
        props (dict): properties
        _: context, not used
    """


def helper_create_update(event, _):
    # properties used by lambda
    props = event["ResourceProperties"]

    # region for source bucket
    source_region = props.get(
        "sourceRegion",
        os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION")),
    )
    logger.info(f"Source Region: {source_region}")
    # region for destination bucket
    dest_region = props.get("destinationRegion", source_region)
    logger.info(f"Destination Region: %s", dest_region)

    # source code bucket
    source_bucket_name = props["sourceBucket"]
    # create s3 resource in correct region for source bucket
    s3_source = boto3.resource("s3", region=source_region)
    # create bucket resource for source bucket
    source_bucket = s3_source.Bucket(source_bucket_name)
    logger.info(f"Source Bucket: %s", source_bucket_name)

    # destination code buckets
    dest_bucket_name = props["destinationBucket"]
    # create s3 resource in correct region for destination buckets
    s3_dest = boto3.resource("s3", region=dest_region)
    # create bucket resources for public and private web buckets
    dest_bucket = s3_dest.Bucket(dest_bucket_name)
    logger.info(f"Destination Bucket: %s", dest_bucket_name)

    # iterate contents of source bucket, and copy contents across
    # without parent folder name
    keys = props["keys"]
    if isinstance(keys, str):
        keys = [keys]
        for key in keys:
            for file in source_bucket.objects.filter(Prefix=key):
                source = {"Bucket": source_bucket_name, "Key": file.key}
                new_key = Path(file.key).relative_to(key)
                # allow individual files to be passed through
                if new_key == "":
                    new_key = Path(file).name
                dest_bucket.copy(source, new_key)
                logger.info("copied %s to %s", file.key, new_key)


@helper.delete
def no_op(_, __):
    """Function to execute on delete - performs no function"""
    pass


def handler_function(event, context):
    """Lambda Function entry point

    Args:
        event (dict): AWS Lambda event
        context (AWS context): AWS Lambda context
    """
    helper(event, context)
