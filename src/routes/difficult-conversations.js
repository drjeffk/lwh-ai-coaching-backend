import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../db/connection.js';

const router = express.Router();

// Get all difficult conversation history
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM difficult_conversation_history 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get difficult conversations error:', error);
    res.status(500).json({ error: 'Failed to get difficult conversations' });
  }
});

// Get single difficult conversation
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM difficult_conversation_history 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get difficult conversation error:', error);
    res.status(500).json({ error: 'Failed to get difficult conversation' });
  }
});

// Create difficult conversation record
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      relationship_type,
      conversation_topic,
      desired_outcome,
      communication_style,
      additional_context,
      feedback,
      detailed_feedback,
      performance_metrics,
      key_strengths,
      improvement_areas,
      actionable_next_steps,
      tenets_rating,
      // Legacy fields
      scenario,
      intensity_level,
      role,
      dialogue_history
    } = req.body;

    // Validate required fields
    if (!relationship_type || !conversation_topic || !desired_outcome || !communication_style) {
      return res.status(400).json({ 
        error: 'Missing required fields: relationship_type, conversation_topic, desired_outcome, communication_style' 
      });
    }

    // Convert JSON objects/arrays to proper format
    // key_strengths and improvement_areas are TEXT[] (array of text), not JSONB
    const keyStrengthsArray = Array.isArray(key_strengths) 
      ? key_strengths 
      : (key_strengths ? [key_strengths] : []);
    const improvementAreasArray = Array.isArray(improvement_areas) 
      ? improvement_areas 
      : (improvement_areas ? [improvement_areas] : []);

    // JSONB fields need to be JSON strings
    const performanceMetricsJson = performance_metrics 
      ? (typeof performance_metrics === 'string' ? performance_metrics : JSON.stringify(performance_metrics))
      : null;
    const detailedFeedbackJson = detailed_feedback 
      ? (typeof detailed_feedback === 'string' ? detailed_feedback : JSON.stringify(detailed_feedback))
      : null;
    const tenetsRatingJson = tenets_rating 
      ? (typeof tenets_rating === 'string' ? tenets_rating : JSON.stringify(tenets_rating))
      : null;
    const actionableNextStepsJson = actionable_next_steps 
      ? (typeof actionable_next_steps === 'string' ? actionable_next_steps : JSON.stringify(actionable_next_steps))
      : null;
    const dialogueHistoryJson = dialogue_history 
      ? (typeof dialogue_history === 'string' ? dialogue_history : JSON.stringify(dialogue_history))
      : null;

    const result = await pool.query(
      `INSERT INTO difficult_conversation_history (
        user_id, relationship_type, conversation_topic, desired_outcome, communication_style,
        additional_context, feedback, detailed_feedback, performance_metrics,
        key_strengths, improvement_areas, actionable_next_steps, tenets_rating,
        scenario, intensity_level, role, dialogue_history
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12::jsonb, $13::jsonb, $14, $15, $16, $17::jsonb)
      RETURNING *`,
      [
        req.user.id,
        relationship_type,
        conversation_topic,
        desired_outcome,
        communication_style,
        additional_context || null,
        feedback || null,
        detailedFeedbackJson,
        performanceMetricsJson,
        keyStrengthsArray,
        improvementAreasArray,
        actionableNextStepsJson,
        tenetsRatingJson,
        scenario || null,
        intensity_level || null,
        role || null,
        dialogueHistoryJson
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create difficult conversation error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Failed to create difficult conversation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update difficult conversation
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      relationship_type,
      conversation_topic,
      desired_outcome,
      communication_style,
      additional_context,
      feedback,
      detailed_feedback,
      performance_metrics,
      key_strengths,
      improvement_areas,
      actionable_next_steps,
      tenets_rating,
      scenario,
      intensity_level,
      role,
      dialogue_history
    } = req.body;

    const result = await pool.query(
      `UPDATE difficult_conversation_history SET
        relationship_type = COALESCE($1, relationship_type),
        conversation_topic = COALESCE($2, conversation_topic),
        desired_outcome = COALESCE($3, desired_outcome),
        communication_style = COALESCE($4, communication_style),
        additional_context = COALESCE($5, additional_context),
        feedback = COALESCE($6, feedback),
        detailed_feedback = COALESCE($7, detailed_feedback),
        performance_metrics = COALESCE($8, performance_metrics),
        key_strengths = COALESCE($9, key_strengths),
        improvement_areas = COALESCE($10, improvement_areas),
        actionable_next_steps = COALESCE($11, actionable_next_steps),
        tenets_rating = COALESCE($12, tenets_rating),
        scenario = COALESCE($13, scenario),
        intensity_level = COALESCE($14, intensity_level),
        role = COALESCE($15, role),
        dialogue_history = COALESCE($16, dialogue_history),
        updated_at = now()
      WHERE id = $17 AND user_id = $18
      RETURNING *`,
      [
        relationship_type,
        conversation_topic,
        desired_outcome,
        communication_style,
        additional_context,
        feedback,
        detailed_feedback,
        performance_metrics,
        key_strengths,
        improvement_areas,
        actionable_next_steps,
        tenets_rating,
        scenario,
        intensity_level,
        role,
        dialogue_history,
        req.params.id,
        req.user.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update difficult conversation error:', error);
    res.status(500).json({ error: 'Failed to update difficult conversation' });
  }
});

// Delete difficult conversation
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM difficult_conversation_history 
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Delete difficult conversation error:', error);
    res.status(500).json({ error: 'Failed to delete difficult conversation' });
  }
});

export default router;

