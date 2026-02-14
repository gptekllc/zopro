
-- Allow authenticated users to insert signatures for their company
CREATE POLICY "Users can insert signatures for their company"
  ON signatures FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

-- Allow authenticated users to update signatures in their company
CREATE POLICY "Users can update signatures in their company"
  ON signatures FOR UPDATE
  USING (company_id IN (
    SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()
  ));

-- Allow admins to delete signatures in their company
CREATE POLICY "Admins can delete signatures in their company"
  ON signatures FOR DELETE
  USING (company_id IN (
    SELECT profiles.company_id FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));
