// Types
interface LogRequest {
    stack: string;
    level: string;
    package: string;
    message: string;
}

interface LogResponse {
    logID: string;
    message: string;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
type BackendPackage = 'cache' | 'controller' | 'cron_job' | 'db' | 'domain' | 
                     'handler' | 'repository' | 'route' | 'service';

// Main Log function
async function Log(level: LogLevel, stack: string, packageName: BackendPackage, message: string): Promise<LogResponse | null> {
    try {
        const requestBody: LogRequest = {
            stack: stack.toLowerCase(),
            level: level.toLowerCase(),
            package: packageName.toLowerCase(),
            message: message
        };

        const response = await fetch('http://20.244.56.144/evaluation-service/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
            const result = await response.json() as LogResponse;
            console.log(`Log sent - ID: ${result.logID}`);
            return result;
        } else {
            console.error(`Log failed: ${response.status} ${response.statusText}`);
            return null;
        }
    } catch (error) {
        console.error('Log error:', error);
        return null;
    }
}

export { 
    Log,
    LogLevel,
    BackendPackage,
    LogRequest,
    LogResponse
};