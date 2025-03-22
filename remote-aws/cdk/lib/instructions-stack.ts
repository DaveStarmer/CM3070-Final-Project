import { CfnParameter, Fn, Stack, StackProps } from 'aws-cdk-lib';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { AccessLevel, Distribution } from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Bucket, CfnMultiRegionAccessPoint } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export class InstructionsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const uniqueId = new CfnParameter(this, "uniqueId", {
      type: "String",
      description: "Unique element for bucket naming",
      allowedPattern: "^[a-z0-9-]{1,32}$"
    })

    const publicUniqueId = new CfnParameter(this, "publicUniqueId", {
      type: "String",
      description: "Unique element for public bucket naming",
      allowedPattern: "^[a-z0-9-]{1,32}$"
    })

    /** Bucket for public code sharing  */
    const publicCodeBucket = new Bucket(this, "publicCodeBucket", {
      bucketName: Fn.sub("public-cam-code-${publicUniqueId}")
    })

  }
}
