# Code Runner Trust Boundary

## Current State
Code execution currently occurs directly on the `worker` Node.js process using raw `child_process.exec` to call `docker run`. 
- **The Risk:** The worker must have access to the host's Docker socket to launch sandboxes. If a candidate discovers a vulnerability in the `worker` script (e.g. command injection via language parameters) or escapes the Docker sandbox container, they gain access to the host machine running the `worker`, compromising internal databases and Redis instances connected to the worker.

## Proposed Secure Architecture: Dedicated Code-Runner Microservice

The trust boundary must be physically separated. Candidate code should never be orchestrated by a worker that possesses database credentials.

```text
[ API (Public) ]
      ↓
[ Redis Queue ]
      ↓
[ Worker (Has DB Access, Trusted) ] 
      ↓ (gRPC / Internal HTTP)
[ Code Runner API (No DB Access, Host possesses Docker Socket) ]
      ↓
[ Docker Sandbox (Untrusted Execution) ]
```

### Isolation Requirements for the Code Runner:
1. **Network Isolation:** The code runner host must be deployed in an isolated subnet with no egress to the internal database, Redis, or API. 
2. **Container Restrictions:** The sandbox container itself must be launched with:
   - `--network none` (No internet or internal access).
   - `cpus` and `memory` limits enforced.
   - `--pids-limit` (Prevents fork bombs).
   - `--security-opt=no-new-privileges:true` and `--cap-drop=ALL` (Prevents root escalation within the container).
   - Run as a non-root user (`nobody`).
3. **Execution API:** The Worker must invoke the Code Runner via structured JSON APIs or gRPC, NEVER via string interpolation or shell commands.

By isolating the code runner, even a catastrophic sandbox escape only grants the attacker access to an ephemeral runner node that contains zero secrets, zero database access, and zero lateral movement capabilities.
