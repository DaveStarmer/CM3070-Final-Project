import { CfnParameter, Fn, Stack, StackProps } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class InstructionsCloudFrontStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const publicUniqueId = new CfnParameter(this, "publicUniqueId", {
            type: "String",
            description: "Unique element for bucket naming",
            allowedPattern: "^[a-z0-9-]{1,32}$"
        })

        const cfCodeBucket = new Bucket(this, "publicCodeBucket", {
            bucketName: Fn.sub("instruct-cf-code-${publicUniqueId}")
        })
    }
}