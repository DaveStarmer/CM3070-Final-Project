import json
import os
import logging
import boto3
from boto3.dynamodb.conditions import Attr

logger = logging.getLogger(__name__)


def handler_function(event, _):
    logger.debug("Event: %s", event)
    logger.debug("Environment Variables: %s", os.environ)

    http_method = event["requestContext"]["httpMethod"]

    if http_method == "PUT":
        return update_activation_status(event)
    elif http_method == "DELETE":
        return delete_video(event)
    else:
        return get_activations(event)


def update_activation_status(event):
    logger.debug("PUT method - update activation status")


def delete_video(event):
    logger.debug("DELETE method - delete video")


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
