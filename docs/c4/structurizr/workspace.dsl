workspace "Private Camera System" "CM3070 Final Project" {

    !identifiers hierarchical

    model {
        u_installer = person "Installer"
        u_user = person "Dashboard User"
        u_viewer = person "External Viewer"
        s = softwareSystem "Security Camera System" {
            tags "Overall System"
            local = group "Local Camera System" {
                movementDetection = container "Movement Detection" {
                    tags "Local"
                }
                camera = container "Camera System" {
                    tags "Local"
                }
            }
            remote = group "Remote System" {
                dashboard = container "Dashboard" {
                    tags "Remote"
                }
                storage = container "Video Storage" {
                    tags "Storage" "Remote"
                }
                db = container "Database" {
                    tags "Storage" "Remote"
                }
            }
            notfication = group "Notification System" {
                notifier = container "Notifier" {
                    tags "Notification"
                }
            }
        }

        # user interactions
        u_installer -> s.movementDetection "Configures"
        u_installer -> s.dashboard "Configures"
        u_installer -> s.notifier "Configures"
        u_user -> s.dashboard "Views notifications and videos"
        u_viewer -> s.dashboard "Views selected recorded videos"
        # u_viewer -> s.storage "Views selected recorded videos"

        s.notifier -> u_user "Sends notification"

        # system interactions
        s.movementDetection -> s.storage "Uploads movement video to" 
        s.storage -> s.notifier "Triggers" 
        
        # local system internal interactions
        s.camera -> s.movementDetection "streams video to"

        # remote system internal interactions
        s.dashboard -> s.storage "Accesses and Deletes Video"
        s.storage -> s.db "Creates Record"
        s.dashboard -> s.db "Updates Video Status"

        # notification system internal interactions
        s.notifier -> s.db "Record notification sent"

        # AWS Deployment
        aws = deploymentEnvironment "AWS Account" {
            aws_users = deploymentNode "Users" {
                tags "invisible"
                u_aws_user = infrastructureNode "Users" {
                    tags "Amazon Web Services - Users"
                }
            }
            aws_deploy = deploymentNode "Amazon Web Services" {
                tags "Amazon Web Services - Cloud"
                aws_s = softwareSystemInstance s
                s3_video = infrastructureNode "Video Storage" {
                    tags "Amazon Web Services - Simple Storage Service S3 Standard"
                }
                cloudfront = infrastructureNode "CloudFront" {
                    tags "Amazon Web Services - CloudFront"
                }
                lambda_auth = infrastructureNode "Authorisation Lambda" {
                    tags "Amazon Web Services - Lambda"
                }
                s3_dashboard = infrastructureNode "Dashboard Website Storage" {
                    tags "Amazon Web Services - Simple Storage Service S3 Standard"
                }
                cognito = infrastructureNode "Cognito" {
                    tags "Amazon Web Services - Cognito"
                }
                notifications_db = infrastructureNode "Notifications Database" {
                    tags "Amazon Web Services - DynamoDB"
                }
                notifications_api = infrastructureNode "Notifications API" {
                    tags "Amazon Web Services - Lambda"
                }
                notifications_sns = infrastructureNode "Notification Topic" {
                    tags "Amazon Web Services - Simple Notification Service"
                }

                cloudfront -> lambda_auth "Call to check authorisation"
                cognito -> lambda_auth "Authorisation interaction"
                lambda_auth -> cognito "Authorisation interaction"
                cloudfront -> s3_dashboard "Retrieve Website"
                cloudfront -> s3_video "Retrieve Video"
                cloudfront -> notifications_api "Retrieves and updates notifications"
                notifications_api -> cloudfront "Returns notification information"
                s3_video -> notifications_sns "Trigger notification"
                notifications_sns -> notifications_db "Store notification"
                notifications_api -> notifications_db "Retrieve Notifications"
            }
                aws_deploy.notifications_sns -> aws_users.u_aws_user "Notify"
                aws_users.u_aws_user -> aws_deploy.cloudfront "Authorise and connect to dashboard through"

        }


    }

    views {

        systemContext s "CameraSystemContext" {
            title "Camera System Context"
            include *
        }

        container s "LocalSystem" {
            title "Local System Container View"
            include ->s.local->
        }
       
        container s "RemoteDashboardSystem" {
            title "Remote Dashboard System Container View"
            include ->s.dashboard-> ->s.storage-> ->s.db->
            exclude "u_installer -> s.local"
            exclude "u_installer -> s.notifier"
            exclude "s.notifier -> u_user"
        }
       
        container s "NotificationSystem" {
            title "Notificiation System Container View"
            include ->s.notifier->
            exclude "s.storage -> s.db"
        }

        container s "FullSystem" {
            title "Full System Container View"
            include *
        }

        deployment s aws {
            include *
        }


        styles {
            element "Element" {
                color #ffffff
                metadata false
            }
            element deploymentEnvironment {
                color black
                metadata true
            }
            element "Local" {
                background green
            }
            element "Remote" {
                background purple
            }
            element "Notification" {
                background blue
            }
            element "Person" {
                background #05527d
                shape person
            }
            element "Overall System" {
                background red
            }
            element "Storage" {
                shape cylinder
            }
            element "invisible" {
                background white
                colour white
            }
            element "Amazon Web Services - Users" {
                background white
            }
            relationship "Relationship" {
                fontSize 36
                width 400
            }
        }
 
        theme https://static.structurizr.com/themes/amazon-web-services-2023.01.31/theme.json
    }


}