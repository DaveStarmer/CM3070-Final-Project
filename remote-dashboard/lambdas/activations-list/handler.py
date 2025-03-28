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

    queryString = event.get("queryStringParameters", {})
    if queryString is None:
        # if provided in event as 'None' rather than not existing
        queryString = {}

    if http_method == "PUT":
        return update_activation_status(event)
    elif http_method == "DELETE":
        return delete_video(event)
    elif http_method == "GET" and queryString.get("video") is not None:
        return get_video_url(event)
    else:
        return get_activations(event)


def update_activation_status(event):
    logger.debug("PUT method - update activation status")
    logger.debug(event)
    body = json.loads(event["body"])

    system_activation = body.get("systemActivation", "").upper()
    if system_activation in ["ENABLED", "DISABLED"]:
        # create ssm client
        ssm_client = boto3.client("ssm")
        # get current value of parameter holding system state
        ssm_client.put_parameter(Name="camera-system-state", Value=system_activation)


def delete_video(event):
    logger.debug("DELETE method - delete video")


def get_video_url(event):
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
        logger.debug("GET method")
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
