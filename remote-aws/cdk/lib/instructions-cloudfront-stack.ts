import { CfnParameter, Fn, Stack, StackProps } from "aws-cdk-lib";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { AccessLevel, Distribution } from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class InstructionsCloudFrontStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        new CfnParameter(this, "uniqueId", {
            type: "String",
            description: "Unique element for bucket naming",
            allowedPattern: "^[a-z0-9-]{1,32}$"
        })

        const publicUniqueId = new CfnParameter(this, "publicUniqueId", {
            type: "String",
            description: "Unique element for bucket naming",
            allowedPattern: "^[a-z0-9-]{1,32}$"
        })

        const cfCodeBucket = new Bucket(this, "publicCodeBucket", {
            bucketName: Fn.sub("instruct-cf-code-${publicUniqueId}")
        })


        new CfnParameter(this, "domainName", {
            type: "String",
            description: "Domain name for instruction site"
        })

        new CfnParameter(this, "certificateArn", {
            type: "String",
            description: "ARN of certificte for domain"
        })

        this.createCloudFrontDistribution()
    }

    createCloudFrontDistribution() {
        const certificate = Certificate.fromCertificateArn(this, "InstructionsCertificate", Fn.ref("certificateArn"))

        const webBucket = new Bucket(this, "InstructionsWebBucket", {
            bucketName: Fn.sub("instruct-web-bucket-${uniqueId}")
        })
        const origin = S3BucketOrigin.withOriginAccessControl(webBucket, {
            originAccessLevels: [AccessLevel.READ, AccessLevel.LIST],
        })
        webBucket.grantRead(ServicePrincipal.fromStaticServicePrincipleName('sts.amazonaws.com'))

        const cfDistro = new Distribution(this, "InstructionsCFDistro", {
            certificate,
            domainNames: [Fn.ref("domainName"), Fn.sub("www.${domainName}")],
            defaultBehavior: {
                origin,
            },
            defaultRootObject: "index.html"
        })

    }
}