"""Strip CDK-specific elements from CloudFormation Template"""

from pathlib import Path
import json


def remove_kvp(dictionary: dict, key: str | int):
    """Remove Key-Value Pair from Dictionary

    Args:
        dictionary (dict): source dictionary
        key (str | int): key to remove if present

    Returns:
        dict: modified dictionary
    """
    if key in dictionary:
        dictionary.pop(key)
    return dictionary


def remove_cdk_requirements(filename: str):
    """Remove CDK-specific elements from single CloudFormation template

    Args:
        filename (str): filename of file to cleanse
    """
    f = open(filename)
    json_dict = json.load(f)
    f.close()

    json_dict["Resources"] = remove_kvp(json_dict["Resources"], "CDKMetadata")
    json_dict["Conditions"] = remove_kvp(
        json_dict["Conditions"], "CDKMetadataAvailable"
    )
    json_dict["Parameters"] = remove_kvp(json_dict["Parameters"], "BootstrapVersion")
    json_dict["Rules"] = remove_kvp(json_dict["Rules"], "CheckBootstrapVersion")
    with open(filename, "w") as f:
        json.dump(json_dict, f, indent=1)
    print(f"{filename} cleansed")


template_files = (
    Path(__file__).parents[1].joinpath("remote-aws").glob("*.template.json")
)
for template_file in template_files:
    remove_cdk_requirements(template_file)
