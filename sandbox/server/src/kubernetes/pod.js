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
            volumes:[
                {
                    name:'workspace-volume',
                    emptyDir:{}
                }
            ],
            initContainers:[
                {
                    name:'init-container',
                    image:'template:tailwind-safe',
                    imagePullPolicy:'IfNotPresent',
                    // The workspace must be dependency-complete before Vite starts.
                    // This is intentionally performed here (rather than trusting an
                    // AI tool call) so every sandbox has Tailwind available.
                    command: ['sh', '-c', 'cp -r /workspace/. /seed/ && cd /seed && npm install --no-audit --no-fund --save-dev tailwindcss@3.4.17 postcss@8.5.3 autoprefixer@10.4.21'],
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
                    image:'template:tailwind-safe',
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
