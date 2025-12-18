-- phpMyAdmin SQL Dump
-- version 4.9.11
-- https://www.phpmyadmin.net/
--
-- Host: database-5017167920.webspace-host.com
-- Erstellungszeit: 11. Mrz 2025 um 11:43
-- Server-Version: 8.0.36
-- PHP-Version: 7.4.33

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Datenbank: `dbs13794540`
--

-- --------------------------------------------------------

--
-- Tabellenstruktur für Tabelle `pois`
--

CREATE TABLE `pois` (
  `poi_id` int NOT NULL,
  `route_id` int DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `image_path` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `location` point NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `type` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `best_time` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Daten für Tabelle `pois`
--

INSERT INTO `pois` (`poi_id`, `route_id`, `name`, `description`, `image_path`, `location`, `created_at`, `type`, `best_time`) VALUES
(68, 23, 'Wurmberg', 'wedwedwdwdwewe', NULL, 0x0000000001010000004ec4a03fcf3c2540fc4c3cdbd7e04940, '2025-03-03 15:48:12', 'gipfel', 'morning'),
(69, 23, 'Klippe', 'wddewed', NULL, 0x000000000101000000deaa105548532540030f3bacefe04940, '2025-03-03 15:48:12', 'highlight', '');

-- --------------------------------------------------------

--
-- Tabellenstruktur für Tabelle `poi_amenities`
--

CREATE TABLE `poi_amenities` (
  `poi_id` int NOT NULL,
  `amenity` varchar(50) COLLATE utf8mb4_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Daten für Tabelle `poi_amenities`
--

INSERT INTO `poi_amenities` (`poi_id`, `amenity`) VALUES
(68, 'charging'),
(68, 'food'),
(68, 'wc');

-- --------------------------------------------------------

--
-- Tabellenstruktur für Tabelle `poi_images`
--

CREATE TABLE `poi_images` (
  `id` int NOT NULL,
  `poi_id` int NOT NULL,
  `image_path` varchar(255) COLLATE utf8mb4_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Tabellenstruktur für Tabelle `routes`
--

CREATE TABLE `routes` (
  `route_id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `start_point` point NOT NULL,
  `end_point` point NOT NULL,
  `distance` float DEFAULT NULL,
  `duration` int DEFAULT NULL,
  `highest_point` float DEFAULT NULL,
  `lowest_point` float DEFAULT NULL,
  `total_ascent` float DEFAULT NULL,
  `total_descent` float DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Daten für Tabelle `routes`
--

INSERT INTO `routes` (`route_id`, `name`, `created_at`, `start_point`, `end_point`, `distance`, `duration`, `highest_point`, `lowest_point`, `total_ascent`, `total_descent`) VALUES
(23, 'Wandern', '2025-03-03 15:48:12', 0x000000000101000000fd169d2cb57625409b8f6b43c5e84940, 0x000000000101000000fd169d2cb57625409b8f6b43c5e84940, 67, 53640, 1139, 293, 2132, 2132),
(24, 'tesroute', '2025-03-07 16:29:16', 0x00000000010100000000000000c0ac0a40cc8b2cb7ad8f4940, 0x0000000001010000000000000020b0114037e0815bc4924940, 88.3, 62460, 35, -1, 201, 199);

-- --------------------------------------------------------

--
-- Tabellenstruktur für Tabelle `users`
--

CREATE TABLE `users` (
  `id` int NOT NULL,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Daten für Tabelle `users`
--

INSERT INTO `users` (`id`, `username`, `password`, `role`, `last_login`, `created_at`) VALUES
(1, 'admin', '$2y$10$v6m/0dKNPVNC1YXtu99M4OODRskA2OIfK9TtXa5qLxggObVZqj9Pe', 'admin', '2025-03-07 15:03:48', '2025-02-28 09:04:06'),
(2, 'user', '$2y$10$PMLm7yyzC.FgU4xJn5v9M.fO9BqKPwTk02NOEjpBpwLOHSKZRmpOa', 'user', NULL, '2025-02-28 09:04:06');

-- --------------------------------------------------------

--
-- Tabellenstruktur für Tabelle `waypoints`
--

CREATE TABLE `waypoints` (
  `waypoint_id` int NOT NULL,
  `route_id` int DEFAULT NULL,
  `position` int NOT NULL,
  `location` point NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Daten für Tabelle `waypoints`
--

INSERT INTO `waypoints` (`waypoint_id`, `route_id`, `position`, `location`) VALUES
(1476, 23, 0, 0x00000000010100000050c422861d6e2540ace5ce4c30e84940),
(1477, 23, 1, 0x0000000001010000001329cde67168254080b9162d40e74940),
(1478, 23, 2, 0x000000000101000000ecf7c43a55662540130a117008e74940),
(1479, 23, 3, 0x00000000010100000021acc612d6662540a54e401361e74940),
(1480, 23, 4, 0x0000000001010000003eaf78ea9166254091b41b7dcce74940),
(1481, 23, 5, 0x0000000001010000009626a5a0db632540410b09185de84940),
(1482, 23, 6, 0x0000000001010000005721e527d5662540b493c151f2e84940),
(1483, 23, 7, 0x0000000001010000004a661969685f2540c7eebb72c0e94940),
(1484, 23, 8, 0x000000000101000000bfefdfbc38592540999d45ef54ea4940),
(1485, 23, 9, 0x000000000101000000ab77b81d1a56254036ae7fd767ea4940),
(1486, 23, 10, 0x0000000001010000008d98d9e731522540384d9f1d70eb4940),
(1487, 23, 11, 0x000000000101000000d671fc5069542540caa7c7b60cec4940),
(1488, 23, 12, 0x000000000101000000a1d79fc4e7562540fbe93f6b7eec4940),
(1489, 23, 13, 0x000000000101000000ef71a609db5725402bdb87bce5ec4940),
(1490, 23, 14, 0x00000000010100000098c0adbb795225405b43a9bd88ec4940),
(1491, 23, 15, 0x000000000101000000a5129ed0eb4f2540da3ba3ad4aec4940),
(1492, 23, 16, 0x000000000101000000c6353e93fd4b25401c959ba8a5eb4940),
(1493, 23, 17, 0x0000000001010000006ccd565ef2472540eb8b84b69ceb4940),
(1494, 23, 18, 0x000000000101000000276a696e85482540075c57cc08eb4940),
(1495, 23, 19, 0x0000000001010000007768588cba4625402cb98ac56fea4940),
(1496, 23, 20, 0x0000000001010000008925e5ee734425406f63b323d5e94940),
(1497, 23, 21, 0x0000000001010000004242942f68412540486fb88fdce84940),
(1498, 23, 22, 0x000000000101000000b8cb7edde9362540b4006dab59e94940),
(1499, 23, 23, 0x000000000101000000d0d4eb1681312540b741edb776ea4940),
(1500, 23, 24, 0x00000000010100000032005471e32e2540b1e07ec003eb4940),
(1501, 23, 25, 0x00000000010100000033c005d9b22c25408a7269fcc2eb4940),
(1502, 23, 26, 0x000000000101000000390b7bdae1272540d9b27c5d86eb4940),
(1503, 23, 27, 0x000000000101000000c3bb5cc4772a254079b130444eeb4940),
(1504, 23, 28, 0x000000000101000000412e71e481282540622ea9da6eea4940),
(1505, 23, 29, 0x000000000101000000e5b8533a58272540c4edd0b018e94940),
(1506, 23, 30, 0x000000000101000000cff8beb85425254040fb912232e84940),
(1507, 23, 31, 0x00000000010100000054e6e61bd11d254030664b5645e84940),
(1508, 23, 32, 0x000000000101000000b6679604a81925409949d40b3ee74940),
(1509, 23, 33, 0x000000000101000000944c4eed0c132540c405a051bae64940),
(1510, 23, 34, 0x000000000101000000e318c91ea11625409642209738e64940),
(1511, 23, 35, 0x000000000101000000abb35a608f19254027a089b0e1e54940),
(1512, 23, 36, 0x00000000010100000082ffad64c71e2540e4654d2cf0e54940),
(1513, 23, 37, 0x000000000101000000ff209221c72625406b2bf697dde54940),
(1514, 23, 38, 0x000000000101000000d7a6b1bd162c254093533bc3d4e44940),
(1515, 23, 39, 0x000000000101000000f60d4c6e14312540b3b5be4868e54940),
(1516, 23, 40, 0x000000000101000000ef74e789e73c25406de525ff93e54940),
(1517, 23, 41, 0x000000000101000000429770e82d3e254033fd12f1d6e54940),
(1518, 23, 42, 0x000000000101000000e4f560527c3c2540dac69fa86ce64940),
(1519, 23, 43, 0x0000000001010000005e4bc8073d3b2540b51a12f758e64940),
(1520, 23, 44, 0x00000000010100000096d05d12673d25400341800c1de54940),
(1521, 23, 45, 0x000000000101000000f31dfcc4013c254097c62fbc92e44940),
(1522, 23, 46, 0x0000000001010000008b6b7c26fb3f25400f7ee200fae34940),
(1523, 23, 47, 0x000000000101000000527fbdc282432540a29c685721e34940),
(1524, 23, 48, 0x0000000001010000008a7269fcc2432540a6272cf180e24940),
(1525, 23, 49, 0x00000000010100000013f241cf66452540b95510035de14940),
(1526, 23, 50, 0x00000000010100000021e527d53e452540522976340ee14940),
(1527, 23, 51, 0x00000000010100000005e09f5225422540433d7d04fee04940),
(1528, 23, 52, 0x000000000101000000575ef23ff93b25404e9a0645f3e04940),
(1529, 23, 53, 0x0000000001010000008f0000e0813d25401333b569d8e04940),
(1530, 23, 54, 0x00000000010100000034ffffdbee3d254059a0ffb3dfe04940),
(1531, 23, 55, 0x0000000001010000000abb287ae04b2540516859f78fe14940),
(1532, 23, 56, 0x00000000010100000027f8a6e9b3532540166a4df38ee14940),
(1533, 23, 57, 0x0000000001010000004776a565a4562540ba313d6189e14940),
(1534, 23, 58, 0x000000000101000000f5f57ccd7259254022fab5f5d3e14940),
(1535, 23, 59, 0x000000000101000000f1f274ae285d2540a054fb743ce24940),
(1536, 23, 60, 0x0000000001010000009fcdaacfd55e25405305a3923ae34940),
(1537, 23, 61, 0x000000000101000000e7abe463776125407cd11e2fa4e34940),
(1538, 23, 62, 0x0000000001010000005bd2510e666325400f9bc8cc05e44940),
(1539, 23, 63, 0x0000000001010000006d6fb724076425403d5fb35c36e44940),
(1540, 23, 64, 0x0000000001010000006553aef02e672540af97a60870e44940),
(1541, 23, 65, 0x000000000101000000be11ddb3ae692540a661f88898e44940),
(1542, 23, 66, 0x000000000101000000ae8383bd89692540cfa0a17f82e54940),
(1543, 23, 67, 0x000000000101000000edbc8dcd8e6c2540336b2920ede54940),
(1544, 23, 68, 0x00000000010100000060e4654d2c702540882b67ef8ce64940),
(1545, 23, 69, 0x000000000101000000bb99d18f86732540e36e10ad15e74940),
(1546, 23, 70, 0x000000000101000000c2bd326fd5752540afb14b546fe74940);

--
-- Indizes der exportierten Tabellen
--

--
-- Indizes für die Tabelle `pois`
--
ALTER TABLE `pois`
  ADD PRIMARY KEY (`poi_id`),
  ADD KEY `route_id` (`route_id`);

--
-- Indizes für die Tabelle `poi_amenities`
--
ALTER TABLE `poi_amenities`
  ADD PRIMARY KEY (`poi_id`,`amenity`);

--
-- Indizes für die Tabelle `poi_images`
--
ALTER TABLE `poi_images`
  ADD PRIMARY KEY (`id`),
  ADD KEY `poi_id` (`poi_id`);

--
-- Indizes für die Tabelle `routes`
--
ALTER TABLE `routes`
  ADD PRIMARY KEY (`route_id`);

--
-- Indizes für die Tabelle `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `idx_username` (`username`);

--
-- Indizes für die Tabelle `waypoints`
--
ALTER TABLE `waypoints`
  ADD PRIMARY KEY (`waypoint_id`),
  ADD KEY `route_id` (`route_id`);

--
-- AUTO_INCREMENT für exportierte Tabellen
--

--
-- AUTO_INCREMENT für Tabelle `pois`
--
ALTER TABLE `pois`
  MODIFY `poi_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=70;

--
-- AUTO_INCREMENT für Tabelle `poi_images`
--
ALTER TABLE `poi_images`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=97;

--
-- AUTO_INCREMENT für Tabelle `routes`
--
ALTER TABLE `routes`
  MODIFY `route_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT für Tabelle `users`
--
ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT für Tabelle `waypoints`
--
ALTER TABLE `waypoints`
  MODIFY `waypoint_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1547;

--
-- Constraints der exportierten Tabellen
--

--
-- Constraints der Tabelle `pois`
--
ALTER TABLE `pois`
  ADD CONSTRAINT `pois_ibfk_1` FOREIGN KEY (`route_id`) REFERENCES `routes` (`route_id`) ON DELETE CASCADE;

--
-- Constraints der Tabelle `poi_amenities`
--
ALTER TABLE `poi_amenities`
  ADD CONSTRAINT `poi_amenities_ibfk_1` FOREIGN KEY (`poi_id`) REFERENCES `pois` (`poi_id`) ON DELETE CASCADE;

--
-- Constraints der Tabelle `poi_images`
--
ALTER TABLE `poi_images`
  ADD CONSTRAINT `poi_images_ibfk_1` FOREIGN KEY (`poi_id`) REFERENCES `pois` (`poi_id`) ON DELETE CASCADE;

--
-- Constraints der Tabelle `waypoints`
--
ALTER TABLE `waypoints`
  ADD CONSTRAINT `waypoints_ibfk_1` FOREIGN KEY (`route_id`) REFERENCES `routes` (`route_id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
