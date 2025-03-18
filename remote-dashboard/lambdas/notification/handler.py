import os
import logging
import boto3

logger = logging.getLogger(__name__)


def handler_function(event, _):
    """Process uploaded video

    copies to correct bucket

    Args:
        event (dict): S3 Trigger Event
        _ (object): Context object - unused
    """
    source_bucket = os.environ.get("SOURCE_BUCKET")
    dest_bucket = os.environ.get("DESTINATION_BUCKET")
    db_table = os.environ.get("DYNAMO_DB_TABLE")

    s3_client = boto3.client("s3")
    db_client = boto3.client("dynamodb")

    # detect if system disabled, and log appropriately
    enabled = system_enabled()
    if not enabled:
        logger.info(
            "System not enabled. Deleting all video uploaded to %s", source_bucket
        )
    else:
        logger.info("Video enabled, updating records and storing video")

    # loop through records in event, to delete or store as appropriate
    for record in event["Records"]:
        object_key = record["s3"]["object"]

        if enabled:
            logger.debug(
                "Copying %s from %s to %s", object_key, source_bucket, dest_bucket
            )

            # copy from source bucket to storage bucket
            s3_client.copy_object(
                CopySource={"Bucket": source_bucket, "Key": object_key},
                Bucket=dest_bucket,
                Key=object_key,
            )

            # log entry in dynamodb table
            # items include the filename, timestamp, camera identifier, and the current status of the clip
            timestamp = object_key[:14]
            camera = os.path.basename(object_key)[15:]
            db_client.put_item(
                TableName=db_table,
                Item={
                    "filename": {"S": object_key},
                    "timestamp": {"S": timestamp},
                    "camera": {"S": camera},
                    "clipStatus": {"S": "NEW"},
                },
            )
            logger.debug("Data written to database")

        # as system currently disabled, delete uploaded video from source bucket
        logger.debug("Deleting %s from %s", object_key, source_bucket)
        s3_client.delete_object(Bucket=source_bucket, Key=object_key)


def system_enabled() -> bool:
    """Decide if system is enabled

    Returns:
        bool: true if enabled, false if not
    """
    # create ssm client
    ssm_client = boto3.client("ssm")
    # get current value of parameter holding system state
    system_state = ssm_client.get_parameter(Name="camera-system-state")

    # return true if string is 'ENABLED' (in any case)
    return system_state.upper() == "ENABLED"
