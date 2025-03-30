import json
import os
import logging
import boto3
from boto3.dynamodb.conditions import Attr

from presigned_url import generate_presigned_url

logger = logging.getLogger(__name__)


def handler_function(event, _):
    """Entrypoint for API calls

    Args:
        event (dict): AWS Event dict
        _ (object): Context object, unused

    Returns:
        _type_: _description_
    """

    logger.debug("Event: %s", event)
    logger.debug("Environment Variables: %s", os.environ)

    http_method = event["requestContext"]["httpMethod"]

    query_params = event.get("queryStringParameters")
    if query_params is None:
        # if provided in event as 'None' rather than not existing
        query_params = {}
    logger.debug("HTTP Request: %s", http_method)
    logger.debug("Query String: %s", query_params)

    if http_method == "DELETE":
        return delete_video(event)
    elif http_method == "GET" and "systemActivation" in query_params:
        return update_activation_status(event)
    elif http_method == "GET" and query_params.get("clipStatus") is not None:
        return update_clip_status(event)
    elif http_method == "GET" and query_params.get("video") is not None:
        return get_video_url(event)
    else:
        return get_activations(event)


def update_activation_status(event: dict) -> dict:
    """Update System Activation status
    respond to an update in system activation status

    Args:
        event (dict): AWS Event

    Returns:
        dict: HTTP Event to return (status 200 OK)
    """
    logger.debug("update activation status")
    logger.debug(event)
    query_params = event["queryStringParameters"]

    system_activation = query_params.get("systemActivation", "").upper()

    # create ssm client
    ssm_client = boto3.client("ssm")

    if system_activation in ["ENABLED", "DISABLED"]:
        # put new value of parameter holding system state
        ssm_client.put_parameter(Name="camera-system-state", Value=system_activation)

        response = {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": True,
            },
        }
    else:
        # get current value of parameter holding system state
        activation_value = ssm_client.get_parameter(Name="camera-system-state")

        response = {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": True,
            },
            "body": json.dumps({"systemActivation": activation_value}),
        }

    return response


def delete_video(event: dict) -> dict:
    """Delete Video clip and update database
    from DELETE HTTP calll

    Args:
        event (dict): AWS Event

    Returns:
        dict: HTTP Event to return (status 200 OK)
    """
    logger.debug("DELETE method - delete video")
    query_params = event["queryStringParameters"]
    if "delete" in query_params:
        delete_key = query_params["delete"]
        logger.info("Deleting %s", delete_key)
        s3_client = boto3.client("s3")
        s3_client.delete_object(
            Bucket=os.environ.get("VIDEO_CLIP_BUCKET"), Key=delete_key
        )
        logger.info("%s deleted", delete_key)
        logger.info("Marking %s as deleted", delete_key)
        db_client = boto3.client("dynamodb")
        timestamp = delete_key[:14]
        camera = os.path.basename(os.path.splitext(delete_key)[0])[15:]
        camera = camera.replace("_", " ")
        db_client.update_item(
            TableName=os.environ["DYNAMODB_TABLE"],
            Key={
                "timestamp": {"S": timestamp},
                "camera": {"S": camera},
            },
            AttributeUpdates={"clipStatus": {"S": "DELETED"}},
        )
        logger.info("%s marked as deleted", delete_key)

    response = {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": True,
        },
    }

    return response


def get_video_url(event: dict) -> dict:
    """Return pre-signed URL for Video

    Args:
        event (dict): AWS Event

    Returns:
        dict: HTTP Event to return (containing URL)
    """
    # share for 1 hour for viewing videos, 7 hours to share them
    if "share" in event["queryStringParameters"]:
        share_duration = 7 * 24 * 60 * 60  # a week of seconds (for sharing)
    else:
        share_duration = 3600  # one hour (for viewing)

    # get bucket and key information
    bucket = os.environ.get("VIDEO_CLIP_BUCKET")
    video_key = event["queryStringParameters"]["video"]
    url = generate_presigned_url(bucket, video_key, "get_object", share_duration)

    response = {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": True,
        },
        "body": url,
    }

    return response


def get_activations(event: dict) -> dict:
    """List Activations in database

    Args:
        event (dict): AWS Lambda event

    Returns:
        dict: response
    """
    table_name = os.environ["DYNAMODB_TABLE"]

    if event["requestContext"]["httpMethod"] == "GET":
        logger.debug("GET method - list activations")
        search_params = event["queryStringParameters"]
        if search_params is None:
            search_params = {}
    else:
        logger.debug("Other method")
        search_params = json.loads(event["body"])
    logger.debug("Search params: %s", search_params)

    ddb_resource = boto3.resource("dynamodb")
    table = ddb_resource.Table(table_name)

    kw_args = {}

    if "new" in search_params:
        kw_args["FilterExpression"] = Attr("clipStatus").eq("NEW")

    response = table.scan(**kw_args)

    api_response = {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": True,
        },
        "body": json.dumps(response["Items"]),
    }

    logger.debug("Response: %s", api_response)

    return api_response


def update_clip_status(event: dict) -> dict:
    """Update clip status

    Args:
        event (dict): AWS Lambda event

    Returns:
        dict: response
    """
    logger.debug("GET method - update clip status")
    query_params = event["queryStringParameters"]

    if "video" not in query_params:
        logger.info("Video not specified in request")
        return {
            "statusCode": 400,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": True,
            },
        }
    video_key = query_params["video"]
    new_status = query_params.get("clipStatus", "VIEWED")
    logger.info("Marking %s as %s", video_key, new_status)
    db_client = boto3.client("dynamodb")
    timestamp = video_key[:14]
    camera = os.path.basename(os.path.splitext(video_key)[0])[15:]
    camera = camera.replace("_", " ")
    db_client.update_item(
        TableName=os.environ["DYNAMODB_TABLE"],
        Key={
            "timestamp": {"S": timestamp},
            "camera": {"S": camera},
        },
        AttributeUpdates={"clipStatus": {"S": new_status}},
    )
    logger.info("%s marked as %s", video_key, new_status)

    response = {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": True,
        },
    }

    return response
