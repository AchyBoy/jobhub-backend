//JobHub/ jobhub-backend/src/routes/phaseGroups.ts
import { Router } from 'express';
import { requireAuthWithTenant } from '../middleware/requireAuthWithTenant';
import { pool } from '../db/postgres';

const router = Router();

router.use(requireAuthWithTenant);

router.get('/', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Missing tenant' });
    }

    // 1️⃣ Fetch groups
    const groupsRes = await pool.query(
      `SELECT id, name, base_phase
FROM phase_groups
       WHERE tenant_id = $1
       ORDER BY name ASC`,
      [tenantId]
    );

    // 2️⃣ Fetch members
const membersRes = await pool.query(
  `
  SELECT m.group_id, m.phase_name
  FROM phase_group_members m
  JOIN phase_groups g ON g.id = m.group_id
  WHERE g.tenant_id = $1
  `,
  [tenantId]
);

    // 3️⃣ Build structure
    const groupsMap: Record<string, any> = {};

groupsRes.rows.forEach(g => {
  groupsMap[g.id] = {
    id: g.id,
    name: g.name,
    basePhase: g.base_phase,
    children: [],
  };
});

    membersRes.rows.forEach(m => {
      if (groupsMap[m.group_id]) {
        groupsMap[m.group_id].children.push(m.phase_name);
      }
    });

    return res.json({
      phaseGroups: Object.values(groupsMap),
    });

  } catch (err) {
    console.error('PhaseGroups GET failed', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/phase-groups
router.post('/', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { basePhase, children } = req.body;

    if (!tenantId) {
      return res.status(401).json({ error: 'Missing tenant' });
    }

    if (!basePhase || !Array.isArray(children) || children.length === 0) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const groupId = Date.now().toString();

    // 1️⃣ Insert group
    await pool.query(
      `
      INSERT INTO phase_groups (id, tenant_id, name, base_phase)
      VALUES ($1, $2, $3, $4)
      `,
      [groupId, tenantId, basePhase, basePhase]
    );

// 2️⃣ Insert members
for (const child of children) {
  await pool.query(
    `
    INSERT INTO phase_group_members (
      id,
      group_id,
      phase_name,
      tenant_id
    )
    VALUES ($1, $2, $3, $4)
    `,
    [
      Date.now().toString() + child,
      groupId,
      child,
      tenantId,
    ]
  );
}

    return res.json({ success: true, groupId });

  } catch (err) {
    console.error('PhaseGroups POST failed', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* =========================================================
   DELETE /api/phase-groups/:id
   Delete a phase group
   ========================================================= */
router.delete('/:id', async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;

  if (!tenantId) {
    return res.status(403).json({ error: 'Missing tenant' });
  }

  try {
    await pool.query(
      `
      DELETE FROM phase_groups
      WHERE id = $1
      AND tenant_id = $2
      `,
      [id, tenantId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Failed deleting phase group', err);
    res.status(500).json({ error: 'Failed deleting phase group' });
  }
});

export default router;