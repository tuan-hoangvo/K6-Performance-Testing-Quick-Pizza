pipeline {
    agent any 

    stages {
        stage('k6') {
            agent {
                docker { 
                    image 'grafana/k6'
                    args '--entrypoint=""'
                    reuseNode true
                }
            }
            steps {
                sh 'k6 run quickPizzaTestScript.js --quiet'
            }
        }
    }

    post {
        always {
            script { 
                def summary = readFile('/var/jenkins_home/workspace/k6-performance-test-quick-pizza/summary.json')
                def teamsWebhook = 'https://rmiteduau.webhook.office.com/webhookb2/60645912-a18a-4533-9d91-47001062141a@d1323671-cdbe-4417-b4d4-bdb24b51316b/IncomingWebhook/e79f58d264ab40faae0f83d6278bd9fc/33f07758-ebcc-45f3-8f43-440caa5f445b/V2iEKPOfv4by6ecuKE4lNEgMkZWGXZbg2UlnhywtzXWWg1'
                def message = """
                {
                    "text": "K6 Performance Test Report Summary",
                    "attachments": [
                        {
                            "contentType": "application/json",
                            "content": $summary
                        }
                    ]
                }
                """
                sh """
                    curl -X POST -H "Content-Type: application/json" -d '{
                        "text": "K6 Performance Test Completed. View the summary here: ${env.BUILD_URL}execution/node/3/ws/summary.json"
                    }' ${teamsWebhook}
                """
            }
        }
    }
}