import type {Reporter,TestCase,TestResult,FullResult} from '@playwright/test/reporter';
// Browser request failures can include cookie and deployment-bypass headers even with trace off.
function safe(value:string){return value.replace(/\/(?:join|invite)\/[A-Za-z0-9-]+/g,'/[access-link redacted]').replace(/^.*(?:cookie:|authorization:|x-vercel-protection-bypass:).*$/gim,'[request credential redacted]').replace(/eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[token redacted]').replace(/sb_secret_[A-Za-z0-9_-]+/g,'[server key redacted]');}
export default class SafeReporter implements Reporter{
 private passed=0;private failed=0;
 onStdOut(chunk:string|Buffer){process.stdout.write(safe(String(chunk)));}
 onStdErr(chunk:string|Buffer){process.stderr.write(safe(String(chunk)));}
 onTestEnd(test:TestCase,result:TestResult){if(result.status==='passed')this.passed++;else this.failed++;process.stdout.write(`${result.status.toUpperCase()} ${test.title} (${(result.duration/1000).toFixed(1)}s)\n`);for(const error of result.errors)process.stdout.write(safe(error.stack??error.message??'Test error')+'\n');}
 onEnd(result:FullResult){process.stdout.write(`${this.passed} passed, ${this.failed} failed; suite ${result.status}\n`);}
}
