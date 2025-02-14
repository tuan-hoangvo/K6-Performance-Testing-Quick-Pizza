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
                // sh 'mkdir -p testReport'
                sh 'k6 run quickPizzaTestScript.js --quiet'
            }
        }
    }

    // post {
    //     always {
    //         archiveArtifacts artifacts: 'testReport/summary.json', fingerprint: true
    //     }
    // }
}