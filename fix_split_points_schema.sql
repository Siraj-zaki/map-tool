-- Fix stage_split_points table schema
-- 1. Add 'gold' to tour_type enum
-- 2. Add location_id column
-- 3. Make start_location nullable

-- Modify tour_type column to include 'gold'
ALTER TABLE `stage_split_points` 
MODIFY COLUMN `tour_type` enum('bronze','silver','gold') NOT NULL;

-- Add location_id column (nullable, references locations table)
ALTER TABLE `stage_split_points` 
ADD COLUMN `location_id` int(11) NULL AFTER `route_id`,
ADD KEY `location_id` (`location_id`);

-- Make start_location nullable for location-based split points
ALTER TABLE `stage_split_points` 
MODIFY COLUMN `start_location` varchar(255) NULL;

-- Update the unique key to include location_id
ALTER TABLE `stage_split_points` 
DROP INDEX `unique_route_tour_stage`,
ADD UNIQUE KEY `unique_route_tour_stage_location` (`route_id`,`tour_type`,`stage_number`,`location_id`);
