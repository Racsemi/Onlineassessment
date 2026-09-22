# Code Execution Security Model

## Overview
Executing untrusted candidate code requires the highest level of isolation within the application infrastructure. The M7 Code Execution architecture uses an asynchronous `worker` processing queue (`BullMQ` + `Redis`) mapped to hardened `Docker` containers.

## Threat Model & Mitigations

### 1. Host Compromise (File System & Privileges)
- **Vector**: A candidate uploads code that attempts to read host files or escape the container.
- **Mitigation**:
  - `docker run --user nobody`: All processes run as the lowest-privileged user.
  - `docker run --security-opt=no-new-privileges:true`: Prevents `su` or `sudo` even if binaries are present.
  - `docker run --cap-drop=ALL`: Drops all Linux kernel capabilities (e.g. `CAP_SYS_ADMIN`, `CAP_NET_RAW`), preventing deep system calls.
  - Only a temporary `workspace` directory is mounted (`:rw`). No host paths or `/var/run/docker.sock` are exposed.

### 2. Network Scanning & Data Exfiltration (SSRF)
- **Vector**: A candidate attempts to curl internal services (e.g., PostgreSQL `10.0.x.x`, Redis, cloud metadata `169.254.169.254`).
- **Mitigation**:
  - `docker run --network none`: The sandbox is entirely disconnected from the host network namespace.
  - Tests verify that `urllib.request` or `fetch` will immediately yield `Name or service not known` or `ENETUNREACH`.

### 3. Denial of Service (CPU & Memory Abuse)
- **Vector**: Infinite loops or fork bombs (`while(1) fork()`) to crash the worker node.
- **Mitigation**:
  - `docker run --cpus="0.5"`: Restricts the container to 50% of a single core.
  - `docker run --memory="128m"`: Prevents Out-Of-Memory host crashes. Exceeding this triggers a kernel `SIGKILL` (Code 137).
  - `docker run --pids-limit=64`: Stops fork bombs instantaneously by limiting process allocation.
  - `timeout: 2000`: Hard timeout wrapper from the Node.js `worker` ensures execution cannot hang indefinitely.

### 4. Data Leakage (Test Case Privacy)
- **Vector**: A candidate logs output in an attempt to glean private test cases or scoring weights.
- **Mitigation**:
  - Private test cases are injected via `stdin` entirely inside the sandbox workspace.
  - The API endpoint (`/evaluate/:questionId`) queues the job asynchronously, preventing synchronous memory observation.
  - The worker maps runtime errors securely and sanitizes `compilerOutput`, ensuring `EXPECTED_OUTPUT` strings never bleed into candidate UI.
