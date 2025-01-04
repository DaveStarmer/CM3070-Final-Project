"""Strip CDK-specific elements from CloudFormation Template"""

from pathlib import Path
import json


def remove_kvp(dictionary: dict, keys: list):
    """Remove Key-Value Pair from Dictionary

    Args:
        dictionary (dict): source dictionary
        key (list): list of keys in path to pair to remove if present

    Returns:
        dict: modified dictionary
    """
    if keys[0] in dictionary:
        if len(keys) == 1:
            dictionary.pop(keys[0])
        else:
            dictionary[keys[0]] = remove_kvp(dictionary[keys[0]], keys[1:])
    return dictionary


def remove_cdk_requirements(filename: str):
    """Remove CDK-specific elements from single CloudFormation template

    Args:
        filename (str): filename of file to cleanse
    """
    f = open(filename, encoding="utf-8")
    json_dict = json.load(f)
    f.close()

    json_dict = remove_kvp(json_dict, ["Resources", "CDKMetadata"])
    json_dict = remove_kvp(json_dict, ["Conditions", "CDKMetadataAvailable"])
    json_dict = remove_kvp(json_dict, ["Parameters", "BootstrapVersion"])
    json_dict = remove_kvp(json_dict, ["Rules", "CheckBootstrapVersion"])
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(json_dict, f, indent=1)
    print(f"{filename} cleansed")


template_files = (
    Path(__file__).parents[1].joinpath("remote-aws").glob("*.template.json")
)
for template_file in template_files:
    remove_cdk_requirements(template_file)
