pipeline {
    agent any 

    stages {
        stage('k6') {
            agent {
                docker { 
                    image 'grafana/k6'
                    args '--entrypoint=""'
                }
            }
            steps {
                // sh 'mkdir -p testReport'
                sh 'k6 run quickPizzaTestScript.js --quiet', reuseNode: true
            }
        }
    }

    // post {
    //     always {
    //         archiveArtifacts artifacts: 'testReport/summary.json', fingerprint: true
    //     }
    // }
}