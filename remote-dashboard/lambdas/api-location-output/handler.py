"""Output API path"""

import json
import os
import logging
import boto3
from crhelper import CfnResource


# Custom Resource helper
helper = CfnResource()

logger = logging.getLogger(__name__)


@helper.create
@helper.update
def copy_files(*_):
    """Copy files between buckets

    Args:
        event (dict): Lambda event
        _: context, not used
    """
    logger.debug("create/update process")

    s3_client = boto3.client("s3")
    s3_client.put_object(
        Bucket=os.environ["CONFIG_BUCKET"],
        Key="config.json",
        Body=json.dumps({"api-endpoint": os.environ["API_ENDPOINT"]}),
    )


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
