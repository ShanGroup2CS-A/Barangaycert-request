USE BeSCMS;

ALTER TABLE residents
    ADD COLUMN tin_no VARCHAR(100) NULL AFTER pagibig_no,
    ADD COLUMN voters_id_no VARCHAR(100) NULL AFTER tin_no;
