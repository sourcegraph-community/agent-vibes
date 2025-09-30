# Incident Response Drill Schedule

## Overview

Regular incident response drills ensure the team is prepared to handle production incidents effectively. This document outlines the schedule, scenarios, and procedures for conducting drills.

## Drill Schedule

### Quarterly Drills (Mandatory)

| Quarter | Date | Scenario | Lead | Participants |
|---------|------|----------|------|--------------|
| Q4 2025 | October 15, 2025 | Apify Rate Limit Ban | Platform Ops Lead | All Backend Engineers |
| Q1 2026 | January 15, 2026 | Supabase Storage Full | Backend Team Lead | Backend + Platform Engineers |
| Q2 2026 | April 15, 2026 | Gemini Quota Exhaustion | ML/AI Lead | Backend + ML Engineers |
| Q3 2026 | July 15, 2026 | Database Connection Pool | Platform Ops Lead | All Backend Engineers |

### Ad-Hoc Drills

- Scheduled after major incidents (within 2 weeks of resolution)
- Scheduled before major releases or infrastructure changes
- On-demand for new team members (onboarding)

## Drill Scenarios

### Scenario 1: Apify Rate Limit Ban

**Objective:** Practice response to Apify scraper rate limit violations

**Preparation:**
- Review [Incident Response Runbook - Incident 1](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/Docs/incident-response-runbook.md#incident-1-apify-rate-limit--ban)
- Ensure access to Apify Console
- Verify Vercel dashboard access

**Simulation Steps:**
1. Drill coordinator announces: "Apify rate limit detected - ≥3 consecutive failures"
2. Team identifies symptoms from monitoring
3. Team executes immediate response (0-15 minutes)
   - Pause Vercel cron
   - Check Apify console for run status
   - Notify stakeholders via Slack
4. Team investigates root cause (15-30 minutes)
   - Review run frequency query
   - Check query configuration
   - Analyze Actor logs
5. Team proposes resolution (30-60 minutes)
   - Increase cooldown period
   - Reduce batch size
   - Switch to manual trigger mode
6. Team validates recovery plan (60-90 minutes)
   - Document wait period
   - Plan gradual resume strategy
   - Update monitoring

**Success Criteria:**
- ✅ Cron paused within 5 minutes
- ✅ Root cause identified within 30 minutes
- ✅ Resolution plan documented within 60 minutes
- ✅ All team members understand recovery steps

**Duration:** 90 minutes

---

### Scenario 2: Supabase Storage Full

**Objective:** Practice response to database storage exhaustion

**Preparation:**
- Review [Incident Response Runbook - Incident 2](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/Docs/incident-response-runbook.md#incident-2-supabase-storage-full)
- Access to Supabase Dashboard
- Cleanup scripts ready

**Simulation Steps:**
1. Drill coordinator announces: "Supabase storage at 92%, insert failures"
2. Team checks current storage usage
3. Team identifies largest tables
4. Team executes immediate response
   - Pause ingestion cron
   - Run storage diagnostic queries
   - Estimate cleanup impact
5. Team chooses resolution option
   - Execute retention policy
   - Plan for upgrade
   - Archive to external storage
6. Team validates recovery
   - Verify storage reduction
   - Test insert operations
   - Resume operations

**Success Criteria:**
- ✅ Storage issue identified within 5 minutes
- ✅ Ingestion paused within 10 minutes
- ✅ Cleanup plan executed within 30 minutes
- ✅ Operations resumed successfully

**Duration:** 60 minutes

---

### Scenario 3: Gemini Quota Exhaustion

**Objective:** Practice response to Gemini API quota limits

**Preparation:**
- Review [Incident Response Runbook - Incident 3](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/Docs/incident-response-runbook.md#incident-3-gemini-api-quota-exhaustion)
- Access to Google Cloud Console
- Replay script ready

**Simulation Steps:**
1. Drill coordinator announces: "High sentiment failure rate, quota errors"
2. Team checks current quota usage
3. Team verifies rate limiting is active
4. Team checks pending backlog size
5. Team chooses resolution
   - Wait for quota reset
   - Reduce processing rate
   - Upgrade to paid tier
6. Team validates recovery
   - Test single request
   - Process backlog gradually
   - Resume automated processing

**Success Criteria:**
- ✅ Quota status checked within 10 minutes
- ✅ Backlog size assessed within 15 minutes
- ✅ Resolution strategy chosen within 30 minutes
- ✅ Recovery validation planned

**Duration:** 60 minutes

---

### Scenario 4: Database Connection Pool Exhaustion

**Objective:** Practice response to connection pool issues

**Preparation:**
- Review [Incident Response Runbook - Incident 6](file:///home/prinova/CodeProjects/agent-vibes/src/ApifyPipeline/Docs/incident-response-runbook.md#incident-6-database-connection-pool-exhaustion)
- Access to Supabase SQL Editor
- Code review tools ready

**Simulation Steps:**
1. Drill coordinator announces: "Too many connections errors, functions timing out"
2. Team checks connection pool usage
3. Team identifies connection sources
4. Team checks for connection leaks
5. Team implements fixes
   - Review Supabase client usage
   - Identify leaks in code
   - Optimize query patterns
6. Team validates recovery
   - Verify connection pool health
   - Test application functions
   - Monitor for leaks

**Success Criteria:**
- ✅ Connection pool status checked within 5 minutes
- ✅ Connection leaks identified within 30 minutes
- ✅ Fix plan implemented within 60 minutes
- ✅ Monitoring shows stable connections

**Duration:** 90 minutes

---

## Drill Procedures

### Pre-Drill (1 week before)

#### Coordinator Responsibilities:
- [ ] Send calendar invite to all participants
- [ ] Share scenario details (but not specific steps)
- [ ] Verify access to required tools and dashboards
- [ ] Prepare drill observation checklist
- [ ] Set up communication channels (Slack, Zoom)

#### Participant Responsibilities:
- [ ] Review relevant incident runbook sections
- [ ] Verify tool access (Supabase, Apify, Vercel, etc.)
- [ ] Familiarize with monitoring queries
- [ ] Clear calendar for drill duration

### During Drill

#### Coordinator Role:
1. **Kick-off (5 minutes)**
   - Explain drill format and objectives
   - Emphasize this is a learning exercise
   - Start timer and announce scenario

2. **Observation (Throughout)**
   - Track response times for each phase
   - Note communication patterns
   - Document issues or confusion
   - Provide hints if team is stuck (after 10 minutes)

3. **Scenario Injection (Optional)**
   - Introduce complications if drill progressing too smoothly
   - Example: "First fix didn't work, what's Plan B?"

#### Participant Responsibilities:
- Assign roles: Incident Commander, Communications, Investigation, Resolution
- Follow runbook procedures
- Document actions taken
- Ask questions and discuss approaches
- Communicate status updates every 15 minutes

### Post-Drill (30 minutes after)

#### Debrief Discussion Topics:
1. **What Went Well:**
   - Response times
   - Team coordination
   - Tool usage
   - Communication

2. **What Could Be Improved:**
   - Knowledge gaps identified
   - Tool access issues
   - Runbook clarity
   - Process inefficiencies

3. **Action Items:**
   - Runbook updates needed
   - Tool access to provision
   - Additional training required
   - Process improvements

#### Coordinator Deliverables:
- [ ] Drill report document
- [ ] Response time metrics
- [ ] Action items with owners
- [ ] Runbook update recommendations
- [ ] Schedule follow-up for action items

## Drill Observation Checklist

### Response Phase

| Checkpoint | Target Time | Actual Time | Notes |
|------------|-------------|-------------|-------|
| Incident acknowledged | 2 minutes | | |
| Initial symptoms identified | 5 minutes | | |
| Stakeholders notified | 10 minutes | | |
| Immediate mitigation started | 15 minutes | | |

### Investigation Phase

| Checkpoint | Target Time | Actual Time | Notes |
|------------|-------------|-------------|-------|
| Root cause hypothesis formed | 30 minutes | | |
| Diagnostic queries executed | 40 minutes | | |
| Root cause confirmed | 50 minutes | | |

### Resolution Phase

| Checkpoint | Target Time | Actual Time | Notes |
|------------|-------------|-------------|-------|
| Resolution plan chosen | 60 minutes | | |
| Fix implemented | 80 minutes | | |
| Recovery validated | 90 minutes | | |

## Success Metrics

### Team Performance

- **Response Time:** Time from incident announcement to first action
  - Target: <2 minutes
  - Good: 2-5 minutes
  - Needs Improvement: >5 minutes

- **Communication:** Clarity and frequency of updates
  - Excellent: Updates every 10 minutes with clear status
  - Good: Updates every 15 minutes
  - Needs Improvement: Irregular or unclear updates

- **Collaboration:** Team coordination and role clarity
  - Excellent: Clear roles, smooth handoffs
  - Good: Some role confusion but resolved quickly
  - Needs Improvement: Unclear roles, communication breakdowns

### Individual Performance

- **Runbook Usage:** Ability to navigate and follow procedures
  - Excellent: Follows runbook steps without prompting
  - Good: Uses runbook with occasional guidance
  - Needs Improvement: Difficulty finding or following procedures

- **Tool Proficiency:** Comfort with Supabase, Apify, Vercel, etc.
  - Excellent: Navigates tools quickly, knows where to find info
  - Good: Uses tools effectively with some searching
  - Needs Improvement: Struggles with tool access or navigation

## New Team Member Onboarding Drill

### Purpose
Accelerated incident response training for new backend engineers

### Schedule
- Within first 2 weeks of joining team
- Paired with experienced team member as mentor
- Focus on tools and communication, not speed

### Shortened Scenario (60 minutes)
1. **Orientation (10 minutes)**
   - Overview of Apify Pipeline architecture
   - Walkthrough of monitoring dashboards
   - Introduction to runbooks

2. **Guided Drill (40 minutes)**
   - Scenario: Sentiment Processing Backlog (low severity)
   - Mentor guides through each runbook step
   - New member executes queries and commands
   - Emphasis on learning, not performance

3. **Debrief (10 minutes)**
   - Questions and clarifications
   - Tool access issues to resolve
   - Schedule follow-up training

## Drill Report Template

```markdown
# Incident Response Drill Report

**Date:** [YYYY-MM-DD]
**Scenario:** [Scenario Name]
**Coordinator:** [Name]
**Participants:** [Names]

## Drill Summary

- **Duration:** [X minutes]
- **Overall Performance:** [Excellent / Good / Needs Improvement]

## Timeline

| Time | Phase | Action | Notes |
|------|-------|--------|-------|
| 0:00 | Detection | Incident announced | |
| 0:02 | Response | Team acknowledged | |
| ... | ... | ... | |

## What Went Well

1. [Point 1]
2. [Point 2]
3. [Point 3]

## Areas for Improvement

1. [Point 1]
2. [Point 2]
3. [Point 3]

## Action Items

| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| Update runbook section X | [Name] | [Date] | Pending |
| Provision access to Y | [Name] | [Date] | Pending |

## Runbook Feedback

- **Clarity:** [Comments on runbook clarity]
- **Completeness:** [Missing steps or information]
- **Accuracy:** [Outdated or incorrect information]

## Recommendations

[Overall recommendations for team, process, or tooling improvements]

## Next Drill

**Proposed Date:** [YYYY-MM-DD]
**Proposed Scenario:** [Scenario Name]
```

---

**Document Owner:** Platform Operations Team  
**Last Updated:** September 30, 2025  
**Next Review:** December 30, 2025
