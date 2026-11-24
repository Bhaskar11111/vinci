import { k8sCoreV1Api } from './config.js'

export const createPod = async (sandboxId) => {
    const podManifest = {
        metadata: {
            name: `sandbox-pod-${sandboxId}`,
            labels: {
                app: 'sandbox',
                sandboxId: sandboxId
            }
        },

        spec: {
            // Sandboxes are intentionally ephemeral. Without an expiry, abandoned
            // previews eventually exhaust the local Kubernetes node and prevent
            // every later workspace from scheduling.
            activeDeadlineSeconds: 7200,
            volumes:[
                {
                    name:'workspace-volume',
                    emptyDir:{}
                }
            ],
            initContainers:[
                {
                    name:'init-container',
                    image:'template:sandbox-ready-v2',
                    imagePullPolicy:'IfNotPresent',
                    // The template image already contains a dependency-complete
                    // workspace. Copying it is deterministic and avoids a network
                    // install on every sandbox creation (which caused readiness to
                    // time out under a slow/offline registry connection).
                    command: ['sh', '-c', 'cp -a /workspace/. /seed/'],
                    volumeMounts:[
                        {
                            name:'workspace-volume',
                            mountPath:'/seed'
                        }
                    ]

                }
            ],
            containers: [
                {
                    image:'template:sandbox-ready-v2',
                    imagePullPolicy:'IfNotPresent',
                    name:'sandbox-container',

                    ports: [
                        {
                            containerPort: 5173,
                            name:'http'
                        }
                    ],

                    resources: {
                        limits: {
                            cpu: '500m',
                            memory: '512Mi'
                        },
                        requests: {
                            cpu: '100m',
                            memory: '192Mi'
                        }
                    },
                    volumeMounts:[
                        {
                            name:'workspace-volume',
                            mountPath: '/workspace'
                        }
                    ]
                },

                {
                        image: 'agent:tailwind-safe',
                        imagePullPolicy: 'IfNotPresent',
                        name: 'agent-container',

                        ports: [
                            {
                                containerPort: 3000,
                                name: 'http'
                            }
                        ],

                        resources: {
                            limits: {
                                cpu: '500m',
                            memory: '512Mi'
                            },
                            requests: {
                            cpu: '100m',
                            memory: '192Mi'
                            }
                        },

                        volumeMounts: [
                            {
                                name: 'workspace-volume',
                                mountPath: '/workspace'
                            }
                        ]
                    }
            ]
        }
    }

    const response = await k8sCoreV1Api.createNamespacedPod({
        namespace: 'default',
        body: podManifest
    })

    return response
}
