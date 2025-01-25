"""Lambda Handler to copy Web Content
Code below is copied with fewer comments into the cloudfront stack, as copying files between
buckets in different regions
"""

# print statements throughout appear in CloudWatch Logs as log entries

import os
from pathlib import Path
import json
import requests
import boto3


def handler_function(event: dict, *_):
    """Entry Point for Lambda to copy code to web buckets"""
    try:
        if event["RequestType"].upper() == "DELETE":
            print("DELETE REQUEST")
            if send_response(event, True):
                print("Delete OK")
                return "Delete OK"
            else:
                print("Delete HTTP call failed")
                return "Delete HTTP call failed."

        # CREATE or UPDATE request
        # copy files across as necessary, and return success (return fail if exception raised)
        print("CREATE/UPDATE REQUEST")
        copy_files(event["ResourceProperties"])
    except Exception as e:
        send_response(event, False)
        print("Create/Update FAILED")
        print(e)
        return "Create/Update FAILED"

    send_response(event, True)
    print("Create/Update SUCCEDED")
    return "Create/Update SUCCEDED"


def copy_files(props: dict):
    """Copy files between buckets

    Args:
        props (Dict): properties
    """
    # region for source bucket
    source_region = props.get(
        "sourceRegion",
        os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION")),
    )
    print(f"Source Region: {source_region}")
    # region for destination bucket
    dest_region = props.get("destinationRegion", source_region)
    print(f"Destination Region: {dest_region}")

    # source code bucket
    source_bucket_name = props["sourceBucket"]
    # create s3 resource in correct region for source bucket
    s3_source = boto3.resource("s3", region=source_region)
    # create bucket resource for source bucket
    source_bucket = s3_source.Bucket(source_bucket_name)
    print(f"Source Bucket: {source_bucket_name}")

    # destination code buckets
    dest_bucket_name = props["destinationBucket"]
    # create s3 resource in correct region for destination buckets
    s3_dest = boto3.resource("s3", region=dest_region)
    # create bucket resources for public and private web buckets
    dest_bucket = s3_dest.Bucket(dest_bucket_name)
    print(f"Destination Bucket: {dest_bucket_name}")

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
                print(f"copied {file.key} to {new_key}")


def send_response(event: dict, success: bool) -> bool:
    response_url = event["ResponseURL"]

    payload = {
        "PhysicalResourceId": event["LogicalResourceId"],
        "StackId": event["StackId"],
        "RequestId": event["RequestId"],
        "LogicalResourceId": event["LogicalResourceId"],
    }

    if success:
        payload["Status"] = "SUCCESS"
    else:
        payload["Status"] = "FAILED"

    response = requests.put(response_url, json=payload)
    print(response)
