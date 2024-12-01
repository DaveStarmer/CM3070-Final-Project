workspace "Private Camera System" "CM3070 Final Project" {

    !identifiers hierarchical


    model {
        u_installer = person "Installer"
        u_user = person "User"
        u_viewer = person "Viewer"
        s_local = softwareSystem "Local Camera System" {
            movementDetection = container "Movement Detection"
        }
        s_remote = softwareSystem "Remote System" {
            dashboard = container "Dashboard"
            storage = container "Storage" {
                tags "Storage"
            }
        }
        s_notification = softwareSystem "Notification System" {
            notifier = container "Notifier"
        }

        # user interactions
        u_installer -> s_local "Configures"
        u_installer -> s_remote.dashboard "Configures"
        u_installer -> s_notification.notifier "Configures"
        u_user -> s_remote.dashboard "Views notifications and videos"
        u_viewer -> s_remote.storage "Views selected recorded videos"

        s_notification.notifier -> u_user "Notifies"

        # system interactions
        s_local.movementDetection -> s_remote.storage "Uploads to"
        s_remote.storage -> s_notification.notifier "Triggers"
        
        # local system internal interactions

        # remote system internal interactions
        s_remote.dashboard -> s_remote.storage "Accesses Video"

        # notification system internal interactions


        # system.dashboard -> system.db "Reads from and writes to"
    }

    views {

        systemLandscape landscape "Private Security Camera System" {
            include *
            # autolayout lr
        }
       
        systemContext s_local "LocalCameraSystem" {
            include *
            autolayout lr
        }

        container s_remote "RemoteDashboardSystem" {
            include *
            autolayout lr
        }

        container s_notification "NotificationSystem" {
            include *
            autolayout lr
        }

        styles {
            element "Element" {
                color #ffffff
            }
            element "Person" {
                background #05527d
                shape person
            }
            element "Software System" {
                background #066296
            }
            element "Container" {
                background #0773af
            }
            element "Storage" {
                shape cylinder
            }
        }
 
        theme https://static.structurizr.com/themes/amazon-web-services-2023.01.31/theme.json
    }



    configuration {
        scope none
    }

}