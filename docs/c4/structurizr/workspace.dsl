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


        styles {
            element "Element" {
                color #ffffff
                metadata false
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
        }
 
        theme https://static.structurizr.com/themes/amazon-web-services-2023.01.31/theme.json
    }


}