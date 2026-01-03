interface FileSystemResponse {
    success: boolean;
    content?: string;
    files?: [string, number][];
    root?: string;
    error?: string;
}

interface FileSystemRequest {
    command: string;
    path?: string;
    content?: string;
    requestId?: string;
}

function sendMessage(request: FileSystemRequest): Promise<FileSystemResponse> {
    return new Promise((resolve, reject) => {
        const requestId = request.requestId || `req_${Date.now()}_${Math.random()}`;
        request.requestId = requestId;

        const messageHandler = (event: MessageEvent) => {
            if (event.data.requestId === requestId && 
                event.data.command === request.command + 'Response') {
                window.removeEventListener('message', messageHandler);
                
                if (event.data.success) {
                    resolve(event.data);
                } else {
                    reject(new Error(event.data.error || 'Operation failed'));
                }
            }
        };

        window.addEventListener('message', messageHandler);
        
        if (window.parent) {
            window.parent.postMessage(request, '*');
        } else {
            reject(new Error('Not running in iframe'));
        }

        setTimeout(() => {
            window.removeEventListener('message', messageHandler);
            reject(new Error('Request timeout'));
        }, 10000);
    });
}

export async function readFile(filePath: string): Promise<string> {
    const response = await sendMessage({
        command: 'readFile',
        path: filePath
    });
    
    if (response.content === undefined) {
        throw new Error('No content returned');
    }
    
    return response.content;
}

export async function writeFile(filePath: string, content: string): Promise<void> {
    const response = await sendMessage({
        command: 'writeFile',
        path: filePath,
        content: content
    });
    
    if (!response.success) {
        throw new Error(response.error || 'Write failed');
    }
}

export async function listFiles(dirPath: string): Promise<[string, number][]> {
    const response = await sendMessage({
        command: 'listFiles',
        path: dirPath
    });
    
    if (response.files === undefined) {
        throw new Error('No files returned');
    }
    
    return response.files;
}

export async function getWorkspaceRoot(): Promise<string> {
    const response = await sendMessage({
        command: 'getWorkspaceRoot'
    });
    
    if (response.root === undefined) {
        throw new Error('No workspace root found');
    }
    
    return response.root;
}

export function isVSCodeContext(): boolean {
    return window.parent !== window && window.parent !== null;
}

