/*
  Destructive center-master replacement.
  READY TO RUN: take a database backup, then execute the entire script.
  It replaces all company/center masters and clears their old assignments.
  Exact duplicates and known spelling variants are merged to canonical names.
*/
USE admin_db;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Locations TABLE (location NVARCHAR(150) NOT NULL);
INSERT INTO @Locations(location) VALUES
(N'A-11, Noida, UP'),(N'A-126, Sector 63, Noida'),(N'A-19, Noida, UP'),(N'A-43, Noida, UP'),
(N'Agra'),(N'Ahmednagar'),(N'Ajmer'),(N'Akola'),(N'Aligarh'),(N'Alwar'),
(N'Amarawati (Maharashtra)'),(N'Amrawati'),(N'Andhra Pradesh'),(N'Anuppur'),(N'Arrah'),
(N'Ashoknagar'),(N'Assam'),(N'Assam- Nagaon'),(N'Auraiya'),(N'B-93, Sector 67 Noida'),
(N'Baleshwar'),(N'Baleshwar (Odisha)'),(N'Bengaluru, Karnataka'),(N'Banka'),(N'Bankura'),
(N'Barabanki'),(N'Barasat'),(N'Bareilly'),(N'Begusarai'),(N'Belagavi'),(N'Benigir Munger'),
(N'Berhampur'),(N'Bhadohi'),(N'Bhadrak'),(N'Bhagalpur'),(N'Bilaspur'),(N'Bokaro'),
(N'Buldhana'),(N'Chamoli'),(N'Chaputa'),(N'Chattarpur'),(N'Chhapra'),(N'Chhatarpur'),
(N'Chittorgarh (Rajasthan)'),(N'Chuchura'),(N'Churu'),(N'Client-Side'),(N'Coimbatore'),
(N'Cuttack'),(N'Dakshin Kannada'),(N'Darbhanga'),(N'DDUGKY-A19'),(N'DDUGKY-Auraiya'),
(N'DDUGKY-Bhagwanpur'),(N'DDUGKY-Hoogly'),(N'DDUGKY-Ranchi'),(N'DDUGKY-Sec-50'),
(N'DDUGKY-Barasat-Kolkata'),(N'Dehradun'),(N'Delhi'),(N'Deoria'),(N'Dhamtari'),
(N'Dharwad'),(N'East Singhbhum'),(N'East singhbum'),(N'Etah'),(N'Etawah'),(N'Faridabad'),
(N'Fatehpur'),(N'Gadchiroli'),(N'Gajapati'),(N'Ganjam'),(N'Ganjam (Odisha)'),(N'Garhwa'),
(N'Gaya'),(N'Giridih'),(N'Giridih-Dhanwad'),(N'Goa'),(N'Godda'),(N'Gopalganj'),
(N'Gorakhpur'),(N'Green Call Arariya'),(N'Green Call Arwal'),(N'Green Call Auraiya'),
(N'Green Call Ayodhya'),(N'Green Call Azamgarh'),(N'Green Call Bagaha'),(N'Green Call Bahraich'),
(N'Green Call Banda'),(N'Green Call Bangalore'),(N'Green Call Bareily'),(N'Green Call Betiah'),
(N'Green Call Bhadohi'),(N'Green Call Bhagalpur'),(N'Green Call Bijnor'),(N'Green Call Deoria'),
(N'Green Call Dhanbad'),(N'Green Call Etah'),(N'Green Call Etawah'),(N'Green Call Farrukhabad'),
(N'Green Call Firozabad'),(N'Green Call Giridh'),(N'Green Call Hazaribag'),(N'Green Call Jamatara'),
(N'Green Call Jamshedpur'),(N'Green Call Kanpur Uttar'),(N'Green Call Katihar'),(N'Green Call Khunti'),
(N'Green Call Lakhisarai'),(N'Green Call Madhupura'),(N'Green Call Nagpur'),(N'Green Call Noida'),
(N'Green Call Odisha'),(N'Green Call Palamu'),(N'Green Call Raipur'),(N'Green Call Saharsa'),
(N'Green Call Supaul'),(N'Gumla'),(N'Guna'),(N'Gwalior'),(N'Hanumangarh (R.J.)'),
(N'Hardoi'),(N'Haridwar'),(N'Haryana'),(N'Hathars'),(N'Hazaribag'),
(N'Hoogly Adisaptagram'),(N'IOCL-Guntur'),(N'IOCL-Vishakhapatnam'),(N'Jagatsinghpur'),
(N'Jagatsinghpur (Odisha)'),(N'Jaisalmer'),(N'Jajpur'),(N'Jajpur (Odisha)'),(N'Jalaun'),
(N'Jalna'),(N'Jamalpur Munger'),(N'Jammu'),(N'Jamui'),(N'Janjgir Champa'),(N'Jashpur'),
(N'Jehanabad'),(N'Jhansi'),(N'Jharkhand'),(N'Jodhpur'),(N'Jonpur'),(N'Kachar'),
(N'Kachar (Assam)'),(N'Kaimur'),(N'Karauli'),(N'Karnataka'),(N'kasganj'),(N'Katihar'),
(N'Katni'),(N'Kendrapada'),(N'Kendujhar'),(N'Khadgarha, Kantatoli'),(N'Khagaria'),
(N'Kheri'),(N'Khurda, Odisha'),(N'Kishanganj'),(N'Kodarma'),(N'Koraput'),(N'Lakhisarai'),
(N'Lalitpur'),(N'Lucknow, Uttar Pradesh'),(N'Madhubani'),(N'Madhya Pradesh'),(N'Maharashtra'),
(N'Meerut'),(N'Mirzapur'),(N'Morena'),(N'Morigaon'),(N'Morigaon (Assam)'),
(N'Mumbai, Maharashtra'),(N'Munger'),(N'Muzaffarnagar'),(N'Muzaffarpur'),
(N'Nagaon'),(N'Nagaon (Assam)'),(N'Nagaur'),(N'Nayagarh'),(N'Niwairi'),(N'Noida'),
(N'North Star- Bardhaman'),(N'North Star- Karimganj'),(N'North Star- Tirrsur'),
(N'North Star-Ambikapur'),(N'North Star-Arrah'),(N'North Star-Baithya'),(N'North Star-Bankura'),
(N'North Star-Bhagalpur'),(N'North Star-Chandigarh'),(N'North Star-Chhapra'),
(N'North Star-Coimbatore'),(N'North Star-Cooch Behar'),(N'North Star-Delhi'),
(N'North Star-Siliguri'),(N'North Star-Ujjain'),(N'North Star-Vishakhapatnam'),
(N'North Star-West Bengal'),(N'Palamu'),(N'Panna'),(N'Patna'),(N'PMKK-Aligarh'),
(N'PMKK-Begusarai'),(N'PMKK-Darbhanga'),(N'PMKK-Etah'),(N'PMKK-Farrukhabad'),
(N'PMKK-Hajipur'),(N'PMKK-Kasganj'),(N'PMKK-Samastipur'),(N'PMKK-Ujiyarpur'),
(N'Prayagraj'),(N'Pundag'),(N'Punjab'),(N'Purabsarai Munger'),(N'Purbi Champaran'),
(N'PURI'),(N'Purnea'),(N'Purnia'),(N'Raipur'),(N'Ramgarh'),(N'Ranchi'),(N'Rewa'),
(N'Rohtas'),(N'Roshni-Jamui'),(N'Rudra prayag'),(N'Sadpura'),(N'Saharanpur'),
(N'Saharsa'),(N'Samastipur'),(N'Sambaji Nagar'),(N'Sambaji Nagar (Maharashtra)'),
(N'Sambhaji nagar'),(N'Sambhal Pur-Odisha'),(N'Samstipur'),(N'Saraikela'),(N'Saran'),
(N'Satna'),(N'Sector 70, Noida'),(N'shahjahanpur'),(N'Sheohar'),(N'Sidhi (M.P.)'),
(N'Sitamarhi'),(N'Sitapur'),(N'Siwan'),(N'Sonbhadra'),(N'Sonepur'),(N'Sonitpur'),
(N'Sonitpur (Assam)'),(N'Sonpur'),(N'Supaul'),(N'Tehri Garhwal'),(N'Telangana'),
(N'Tikamgarh'),(N'Tinsukia'),(N'Tonk'),(N'Udam singh nagar'),
(N'Utkarsh Bangla - Bankura'),(N'Utkarsh Bangla - Hoogly'),(N'Uttar kashi'),
(N'Uttar Pradesh'),(N'Uttarakhand'),(N'Vadodara'),(N'Vaishali'),(N'Vidisha'),
(N'Vijayawada'),(N'West Bengal'),(N'West Singhbhum'),(N'Yes Foundation-Barasat');

DECLARE @CleanLocations TABLE (location NVARCHAR(150) NOT NULL PRIMARY KEY);
INSERT INTO @CleanLocations(location)
SELECT DISTINCT CASE LTRIM(RTRIM(location))
  WHEN N'Amarawati (Maharashtra)' THEN N'Amravati, Maharashtra'
  WHEN N'Amrawati' THEN N'Amravati, Maharashtra'
  WHEN N'Assam- Nagaon' THEN N'Nagaon, Assam'
  WHEN N'Nagaon' THEN N'Nagaon, Assam'
  WHEN N'Nagaon (Assam)' THEN N'Nagaon, Assam'
  WHEN N'Baleshwar' THEN N'Baleshwar, Odisha'
  WHEN N'Baleshwar (Odisha)' THEN N'Baleshwar, Odisha'
  WHEN N'Chattarpur' THEN N'Chhatarpur'
  WHEN N'East singhbum' THEN N'East Singhbhum'
  WHEN N'Ganjam' THEN N'Ganjam, Odisha'
  WHEN N'Ganjam (Odisha)' THEN N'Ganjam, Odisha'
  WHEN N'Hathars' THEN N'Hathras'
  WHEN N'Jagatsinghpur' THEN N'Jagatsinghpur, Odisha'
  WHEN N'Jagatsinghpur (Odisha)' THEN N'Jagatsinghpur, Odisha'
  WHEN N'Jajpur' THEN N'Jajpur, Odisha'
  WHEN N'Jajpur (Odisha)' THEN N'Jajpur, Odisha'
  WHEN N'Jonpur' THEN N'Jaunpur'
  WHEN N'Kachar' THEN N'Cachar, Assam'
  WHEN N'Kachar (Assam)' THEN N'Cachar, Assam'
  WHEN N'kasganj' THEN N'Kasganj'
  WHEN N'Morigaon' THEN N'Morigaon, Assam'
  WHEN N'Morigaon (Assam)' THEN N'Morigaon, Assam'
  WHEN N'Niwairi' THEN N'Niwari'
  WHEN N'North Star- Tirrsur' THEN N'North Star-Thrissur'
  WHEN N'PURI' THEN N'Puri'
  WHEN N'Purnea' THEN N'Purnia'
  WHEN N'Rudra prayag' THEN N'Rudraprayag'
  WHEN N'Sambaji Nagar' THEN N'Sambhaji Nagar, Maharashtra'
  WHEN N'Sambaji Nagar (Maharashtra)' THEN N'Sambhaji Nagar, Maharashtra'
  WHEN N'Sambhaji nagar' THEN N'Sambhaji Nagar, Maharashtra'
  WHEN N'Sambhal Pur-Odisha' THEN N'Sambalpur, Odisha'
  WHEN N'Samstipur' THEN N'Samastipur'
  WHEN N'shahjahanpur' THEN N'Shahjahanpur'
  WHEN N'Sonepur' THEN N'Sonpur'
  WHEN N'Sonitpur' THEN N'Sonitpur, Assam'
  WHEN N'Sonitpur (Assam)' THEN N'Sonitpur, Assam'
  WHEN N'Udam singh nagar' THEN N'Udham Singh Nagar'
  WHEN N'Uttar kashi' THEN N'Uttarkashi'
  ELSE LTRIM(RTRIM(location)) END
FROM @Locations;

BEGIN TRANSACTION;

-- Detach historical/user references before replacing the referenced master.
UPDATE users SET center_code = NULL WHERE center_code IS NOT NULL;
UPDATE requests SET home_center_code=NULL, fulfil_center_code=NULL,
  request_center_code=NULL, approval_center_code=NULL, charge_center_code=NULL,
  inventory_center_code=NULL
WHERE home_center_code IS NOT NULL OR fulfil_center_code IS NOT NULL
  OR request_center_code IS NOT NULL OR approval_center_code IS NOT NULL
  OR charge_center_code IS NOT NULL OR inventory_center_code IS NOT NULL;
UPDATE approval_policies SET center_code=NULL WHERE center_code IS NOT NULL;
UPDATE request_assignments SET center_code=NULL WHERE center_code IS NOT NULL;
UPDATE stock_movements SET center_code=NULL WHERE center_code IS NOT NULL;
DELETE FROM user_centers;
DELETE FROM center_inventory;
DELETE FROM center_budgets;
DELETE FROM centers;
DELETE FROM companies;

INSERT INTO companies(code,name,legal_name) VALUES
  ('VI',N'Vision India',N'Vision India'),
  ('GC',N'GreenCall Technology',N'GreenCall Technology'),
  ('JJ',N'Just Job',N'Just Job'),
  ('LS',N'Live Skills',N'Live Skills'),
  ('TF',N'Talent Foundation',N'Talent Foundation'),
  ('NS',N'North Star',N'North Star');

-- Preserve known company membership; unknown/legacy values move to Vision India.
UPDATE users SET company=CASE
  WHEN UPPER(company) IN ('GC','GREEN CALL','GREENCALL','GREENCALL TECHNOLOGY') THEN N'GreenCall Technology'
  WHEN UPPER(company) IN ('JJ','JUST JOB') THEN N'Just Job'
  WHEN UPPER(company) IN ('LS','LIVE SKILLS') THEN N'Live Skills'
  WHEN UPPER(company) IN ('TF','TALENT FOUNDATION') THEN N'Talent Foundation'
  WHEN UPPER(company) IN ('NS','NORTH STAR') THEN N'North Star'
  ELSE N'Vision India' END;
UPDATE requests SET company=CASE
  WHEN UPPER(company) IN ('GC','GREEN CALL','GREENCALL','GREENCALL TECHNOLOGY') THEN N'GreenCall Technology'
  WHEN UPPER(company) IN ('JJ','JUST JOB') THEN N'Just Job'
  WHEN UPPER(company) IN ('LS','LIVE SKILLS') THEN N'Live Skills'
  WHEN UPPER(company) IN ('TF','TALENT FOUNDATION') THEN N'Talent Foundation'
  WHEN UPPER(company) IN ('NS','NORTH STAR') THEN N'North Star'
  ELSE N'Vision India' END;
UPDATE teams SET company=CASE
  WHEN UPPER(company) IN ('GC','GREEN CALL','GREENCALL','GREENCALL TECHNOLOGY') THEN N'GreenCall Technology'
  WHEN UPPER(company) IN ('JJ','JUST JOB') THEN N'Just Job'
  WHEN UPPER(company) IN ('LS','LIVE SKILLS') THEN N'Live Skills'
  WHEN UPPER(company) IN ('TF','TALENT FOUNDATION') THEN N'Talent Foundation'
  WHEN UPPER(company) IN ('NS','NORTH STAR') THEN N'North Star'
  ELSE N'Vision India' END;

;WITH ranked AS (
  SELECT location, ROW_NUMBER() OVER (ORDER BY location) AS row_no FROM @CleanLocations
)
INSERT INTO centers(code,name,city,company,is_active)
SELECT CASE location
    WHEN N'A-11, Noida, UP' THEN N'A11NOIDA'
    WHEN N'A-126, Sector 63, Noida' THEN N'A126NOIDA'
    WHEN N'A-19, Noida, UP' THEN N'A19NOIDA'
    WHEN N'A-43, Noida, UP' THEN N'A43NOIDA'
    WHEN N'B-93, Sector 67 Noida' THEN N'B93NOIDA'
    ELSE N'CTR' + RIGHT(N'0000' + CONVERT(NVARCHAR(4),row_no),4)
  END,
  location,
  CASE WHEN CHARINDEX(N',',location)>0
    THEN LTRIM(RTRIM(LEFT(location,CHARINDEX(N',',location)-1))) ELSE location END,
  CASE
    WHEN location LIKE N'Green Call %' THEN N'GreenCall Technology'
    WHEN location LIKE N'North Star%' THEN N'North Star'
    WHEN location LIKE N'Yes Foundation%' THEN N'Talent Foundation'
    ELSE N'Vision India' END,1
FROM ranked;

-- New centers begin with real zero stock; no invented opening quantities.
INSERT INTO center_inventory(center_code,sku,qty,reserved_qty)
SELECT c.code,i.sku,0,0 FROM centers c CROSS JOIN inventory i;

DECLARE @Inserted INT = (SELECT COUNT(*) FROM centers);
IF @Inserted <> (SELECT COUNT(*) FROM @CleanLocations)
  THROW 50001, 'Center replacement count mismatch; transaction rolled back.', 1;

COMMIT TRANSACTION;
SELECT id,code,name,legal_name FROM companies ORDER BY name;
SELECT id,code,name,city,company,is_active FROM centers ORDER BY name;
GO
