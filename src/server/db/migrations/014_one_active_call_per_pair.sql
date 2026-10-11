-- Close elapsed calls and unconfirmed requests. The worker and authenticated
-- meeting reads/creation both run this, so scheduling does not depend on a tab.
CREATE FUNCTION close_due_call_meetings(participant text DEFAULT NULL) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE m scheduled_calls%ROWTYPE; closed integer := 0; heading text;
BEGIN
  FOR m IN UPDATE scheduled_calls
    SET status=CASE WHEN status='confirmed' THEN 'completed' ELSE 'cancelled' END,
      note=CASE WHEN status='confirmed' THEN 'The scheduled meeting has ended.' ELSE 'The requested time passed without confirmation.' END,
      proposed_at=NULL,proposed_by=NULL,version=version+1,updated_at=now()
    WHERE (participant IS NULL OR customer_id=participant OR pro_id=participant)
      AND ((status='confirmed' AND starts_at+interval '30 minutes'<=now())
        OR (status='requested' AND COALESCE(proposed_at,starts_at)<=now()))
    RETURNING *
  LOOP
    closed := closed+1;
    heading := CASE WHEN m.status='completed' THEN 'Call meeting completed' ELSE 'Call request expired' END;
    INSERT INTO notifications(id,user_id,title,body,target_page,target_id)
      SELECT gen_random_uuid(),u,heading,m.note||' You can schedule a new meeting.','schedule',m.id::text
      FROM unnest(ARRAY[m.customer_id,m.pro_id]) u;
    INSERT INTO email_outbox(id,user_id,subject,body)
      SELECT gen_random_uuid(),id,heading,m.note||' You can schedule a new meeting.'
      FROM users WHERE id=ANY(ARRAY[m.customer_id,m.pro_id]) AND COALESCE((settings->>'emailAlerts')::boolean,true);
  END LOOP;
  RETURN closed;
END $$;
SELECT close_due_call_meetings();

-- Preserve a confirmed meeting first, then the earliest request. Historical
-- duplicates remain visible as cancelled records; no user data is deleted.
DO $$
DECLARE m scheduled_calls%ROWTYPE;
BEGIN
  FOR m IN UPDATE scheduled_calls SET status='cancelled',proposed_at=NULL,proposed_by=NULL,
    version=version+1,updated_at=now(),note='Another active meeting with this person was retained. Manage it in Schedule.'
    WHERE id IN (SELECT id FROM (
      SELECT id,row_number() OVER (PARTITION BY customer_id,pro_id ORDER BY (status='confirmed') DESC,starts_at,created_at,id) AS position
      FROM scheduled_calls WHERE status IN ('requested','confirmed')
    ) ranked WHERE position>1) RETURNING *
  LOOP
    INSERT INTO notifications(id,user_id,title,body,target_page,target_id)
      SELECT gen_random_uuid(),u,'Duplicate call request closed',m.note,'schedule',m.id::text
      FROM unnest(ARRAY[m.customer_id,m.pro_id]) u;
  END LOOP;
END $$;
CREATE UNIQUE INDEX scheduled_calls_one_active_pair ON scheduled_calls(customer_id,pro_id)
  WHERE status IN ('requested','confirmed');
