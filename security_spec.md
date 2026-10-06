# Security Specification — Home Recipe Foods HR System

## 1. Data Invariants
1. **Role Integrity (`users`)**: Only a `SUPER_ADMIN` can create or modify user roles (`SUPER_ADMIN`, `ADMIN`, `MANAGER`) or `assignedDepartmentIds`. No user can self-escalate privileges.
2. **Department Isolation for Managers**: A `MANAGER` can only read `employees`, `leaves`, and `absences` where `resource.data.departmentId` is contained within their `assignedDepartmentIds` list in `/users/$(request.auth.uid)`.
3. **Financial Isolation**: Collections `snack_purchases`, `advances`, `salary_sheets`, and `salary_records` are strictly inaccessible (`read: false, write: false`) to any user with role `MANAGER`. Only `SUPER_ADMIN` and `ADMIN` can read/write them.
4. **Absence Creation by Manager**: A `MANAGER` can create a document in `absences` only if `request.resource.data.departmentId` is in their `assignedDepartmentIds` and `createdAt == request.time`.
5. **Immutable Audit Logs (`activity_logs`)**: Audit logs can be created by authenticated users with `timestamp == request.time` and `userId == request.auth.uid`, can only be read by `SUPER_ADMIN`, and can NEVER be updated or deleted (`allow update, delete: if false;`).
6. **Temporal Integrity**: Every write operation must use `request.time` for `createdAt` (on create) and `updatedAt` (on update), and `createdAt` is immutable on update.

## 2. The "Dirty Dozen" Payloads
1. **Privilege Escalation Payload**: A `MANAGER` attempts to update `/users/{theirUid}` with `{ "role": "SUPER_ADMIN" }`.
2. **Shadow Field Injection Payload**: An `ADMIN` attempts to create `/employees/emp_1` with `{ ..., "isSecretSuperUser": true }`.
3. **Cross-Department Manager Read/Write**: A `MANAGER` assigned to Department `[1]` attempts to create `/absences/abs_99` with `{ "departmentId": 2, "employeeId": 5, ... }`.
4. **Manager Financial Espionage**: A `MANAGER` attempts to `get` or `list` `/salary_records`, `/advances`, or `/snack_purchases`.
5. **Audit Log Tampering**: An `ADMIN` or `SUPER_ADMIN` attempts to `update` or `delete` `/activity_logs/log_1`.
6. **Timestamp Forgery**: A user attempts to create `/leaves/lv_1` with a backdated `createdAt` timestamp != `request.time`.
7. **ID Poisoning Payload**: A user attempts to create a document with a 500-character document ID containing special characters.
8. **Value Poisoning Payload**: An `ADMIN` attempts to update `/employees/emp_1` setting `basicSalary: "OneMillionStrings"`.
9. **Unverified Email Spoof**: A token with `email == "mdmahmudulhashan0@gmail.com"` but `email_verified == false` attempts admin writes.
10. **Immortal Field Mutation**: An `ADMIN` attempts to mutate `createdAt` or `createdBy` during an employee update.
11. **Manager Settings Modification**: A `MANAGER` or `ADMIN` attempts to update `/settings/global`.
12. **Blanket PII Scraping**: An unauthenticated or unauthorized user attempts to list `/users`.
