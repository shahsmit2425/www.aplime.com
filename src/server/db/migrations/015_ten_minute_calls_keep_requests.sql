-- Confirmed calls last ten minutes. Pending requests remain open until a
-- participant responds/cancels or the project lifecycle closes the meeting.
CREATE OR REPLACE FUNCTION close_due_call_meetings(participant text DEFAULT NULL) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE m scheduled_calls%ROWTYPE; closed integer := 0;
BEGIN
  FOR m IN UPDATE scheduled_calls
    SET status='completed',note='The scheduled ten-minute meeting has ended.',
      proposed_at=NULL,proposed_by=NULL,version=version+1,updated_at=now()
    WHERE (participant IS NULL OR customer_id=participant OR pro_id=participant)
      AND status='confirmed' AND starts_at+interval '10 minutes'<=now()
    RETURNING *
  LOOP
    closed := closed+1;
    INSERT INTO notifications(id,user_id,title,body,target_page,target_id)
      SELECT gen_random_uuid(),u,'Call meeting completed',m.note||' You can schedule a new meeting.','schedule',m.id::text
      FROM unnest(ARRAY[m.customer_id,m.pro_id]) u;
    INSERT INTO email_outbox(id,user_id,subject,body)
      SELECT gen_random_uuid(),id,'Call meeting completed',m.note||' You can schedule a new meeting.'
      FROM users WHERE id=ANY(ARRAY[m.customer_id,m.pro_id]) AND COALESCE((settings->>'emailAlerts')::boolean,true);
  END LOOP;
  RETURN closed;
END $$;
SELECT close_due_call_meetings();
