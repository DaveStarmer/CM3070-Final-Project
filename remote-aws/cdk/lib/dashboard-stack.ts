import { CfnParameter, CfnStackSet, Fn, Stack, StackProps } from 'aws-cdk-lib';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';


export class DashboardStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new CfnParameter(this, "uniqueId", {
      type: "String",
      description: "Unique element for resource naming",
      allowedPattern: "^[a-z0-9-]{1,32}$",
      default: props?.env?.account
    })

  }
}
