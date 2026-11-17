-- ArtiSoul Phase 15 - artisan events at well-known crowd venues.
-- 10 venues in and around Pune, each with upcoming weekend slots.
-- Prices are INDICATIVE estimates for a day's booking; the admin confirms the
-- real rate with the venue before approving. Times are stored in UTC
-- (the slots below are 4 hours 30 minutes behind the IST opening times).
USE artisoul;

CREATE TABLE IF NOT EXISTS Venues (
  venue_id    INT NOT NULL AUTO_INCREMENT,
  name        VARCHAR(120) NOT NULL,
  area        VARCHAR(80)  NOT NULL,
  city        VARCHAR(60)  NOT NULL DEFAULT 'Pune',
  latitude    DECIMAL(9,6) NOT NULL,
  longitude   DECIMAL(9,6) NOT NULL,
  capacity_stalls INT NOT NULL,
  description VARCHAR(300) NULL,
  PRIMARY KEY (venue_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS VenueSlots (
  slot_id   INT NOT NULL AUTO_INCREMENT,
  venue_id  INT NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at   DATETIME NOT NULL,
  price     DECIMAL(10,2) NOT NULL,
  status    ENUM('available','booked') NOT NULL DEFAULT 'available',
  PRIMARY KEY (slot_id),
  INDEX idx_slots_venue (venue_id, starts_at),
  FOREIGN KEY (venue_id) REFERENCES Venues(venue_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- A "call" for artisans at one venue slot. open -> pending_approval (when at
-- least 30% of artisans said yes) -> approved (admin booked) / rejected.
CREATE TABLE IF NOT EXISTS Events (
  event_id    INT NOT NULL AUTO_INCREMENT,
  slot_id     INT NOT NULL,
  created_by  INT NOT NULL,
  title       VARCHAR(120) NOT NULL,
  description TEXT NULL,
  activities  SET('exhibit','sell','resale','popup_shop','meetup','inspire','workshop') NOT NULL,
  status      ENUM('open','pending_approval','approved','rejected','cancelled') NOT NULL DEFAULT 'open',
  decided_by  INT NULL,
  decision_note VARCHAR(300) NULL,
  decided_at  DATETIME NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id),
  INDEX idx_events_slot (slot_id),
  FOREIGN KEY (slot_id) REFERENCES VenueSlots(slot_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- One answer per artisan per event. A "yes" is a commitment and is final.
CREATE TABLE IF NOT EXISTS EventResponses (
  event_id     INT NOT NULL,
  artisan_id   INT NOT NULL,
  response     ENUM('yes','no') NOT NULL,
  activities   SET('exhibit','sell','resale','popup_shop','meetup','inspire','workshop') NULL,
  acknowledged TINYINT(1) NOT NULL DEFAULT 0,
  responded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, artisan_id),
  FOREIGN KEY (event_id) REFERENCES Events(event_id) ON DELETE CASCADE,
  FOREIGN KEY (artisan_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO Venues (venue_id, name, area, latitude, longitude, capacity_stalls, description) VALUES (1, 'Agriculture College Ground', 'Shivajinagar', 18.5308, 73.8478, 120, 'Large open ground that already hosts craft fairs and food festivals.');
INSERT INTO VenueSlots (venue_id, starts_at, ends_at, price) VALUES
  (1, '2026-12-05 04:30:00', '2026-12-05 15:30:00', 60000),
  (1, '2026-12-19 04:30:00', '2026-12-19 15:30:00', 60000),
  (1, '2027-01-03 04:30:00', '2027-01-03 15:30:00', 69000),
  (1, '2027-01-17 04:30:00', '2027-01-17 15:30:00', 69000);
INSERT INTO Venues (venue_id, name, area, latitude, longitude, capacity_stalls, description) VALUES (2, 'Ganesh Kala Krida Manch', 'Swargate', 18.5018, 73.8636, 60, 'Covered exhibition hall in the old city, easy to reach by bus.');
INSERT INTO VenueSlots (venue_id, starts_at, ends_at, price) VALUES
  (2, '2026-12-06 04:30:00', '2026-12-06 14:30:00', 51750),
  (2, '2026-12-20 04:30:00', '2026-12-20 14:30:00', 51750),
  (2, '2027-01-09 04:30:00', '2027-01-09 14:30:00', 45000),
  (2, '2027-01-23 04:30:00', '2027-01-23 14:30:00', 45000);
INSERT INTO Venues (venue_id, name, area, latitude, longitude, capacity_stalls, description) VALUES (3, 'Balgandharva Rangmandir (foyer and lawns)', 'Jangli Maharaj Road', 18.5225, 73.847, 25, 'Cultural centre with an art gallery crowd; good for small exhibitions and talks.');
INSERT INTO VenueSlots (venue_id, starts_at, ends_at, price) VALUES
  (3, '2026-12-12 04:30:00', '2026-12-12 14:30:00', 25000),
  (3, '2026-12-26 04:30:00', '2026-12-26 14:30:00', 25000),
  (3, '2027-01-10 04:30:00', '2027-01-10 14:30:00', 28750),
  (3, '2027-01-24 04:30:00', '2027-01-24 14:30:00', 28750);
INSERT INTO Venues (venue_id, name, area, latitude, longitude, capacity_stalls, description) VALUES (4, 'Phoenix Marketcity (central atrium)', 'Viman Nagar', 18.5622, 73.9166, 40, 'Busy shopping mall with heavy weekend footfall.');
INSERT INTO VenueSlots (venue_id, starts_at, ends_at, price) VALUES
  (4, '2026-12-13 05:30:00', '2026-12-13 16:00:00', 138000),
  (4, '2026-12-27 05:30:00', '2026-12-27 16:00:00', 138000),
  (4, '2027-01-16 05:30:00', '2027-01-16 16:00:00', 120000),
  (4, '2027-01-30 05:30:00', '2027-01-30 16:00:00', 120000);
INSERT INTO Venues (venue_id, name, area, latitude, longitude, capacity_stalls, description) VALUES (5, 'Empress Botanical Garden', 'Camp', 18.5045, 73.8935, 50, 'Garden venue known for flower shows; calm, family crowd.');
INSERT INTO VenueSlots (venue_id, starts_at, ends_at, price) VALUES
  (5, '2026-12-19 03:30:00', '2026-12-19 12:30:00', 35000),
  (5, '2027-01-02 03:30:00', '2027-01-02 12:30:00', 35000),
  (5, '2027-01-17 03:30:00', '2027-01-17 12:30:00', 40250),
  (5, '2027-01-31 03:30:00', '2027-01-31 12:30:00', 40250);
INSERT INTO Venues (venue_id, name, area, latitude, longitude, capacity_stalls, description) VALUES (6, 'Sarasbaug', 'Sadashiv Peth', 18.5003, 73.8526, 30, 'Popular park and temple garden with daily evening crowds.');
INSERT INTO VenueSlots (venue_id, starts_at, ends_at, price) VALUES
  (6, '2026-12-20 02:30:00', '2026-12-20 13:30:00', 23000),
  (6, '2027-01-03 02:30:00', '2027-01-03 13:30:00', 23000),
  (6, '2027-01-23 02:30:00', '2027-01-23 13:30:00', 20000),
  (6, '2026-12-05 02:30:00', '2026-12-05 13:30:00', 20000);
INSERT INTO Venues (venue_id, name, area, latitude, longitude, capacity_stalls, description) VALUES (7, 'Pu La Deshpande Udyan', 'Sinhgad Road', 18.493, 73.837, 30, 'Japanese-style garden; suits workshops and quiet exhibits.');
INSERT INTO VenueSlots (venue_id, starts_at, ends_at, price) VALUES
  (7, '2026-12-26 03:30:00', '2026-12-26 12:30:00', 18000),
  (7, '2027-01-09 03:30:00', '2027-01-09 12:30:00', 18000),
  (7, '2027-01-24 03:30:00', '2027-01-24 12:30:00', 20700),
  (7, '2026-12-06 03:30:00', '2026-12-06 12:30:00', 20700);
INSERT INTO Venues (venue_id, name, area, latitude, longitude, capacity_stalls, description) VALUES (8, 'Yashwantrao Chavan Natya Gruha', 'Kothrud', 18.5074, 73.8077, 35, 'Theatre complex with a large lobby; good for meetups and talks.');
INSERT INTO VenueSlots (venue_id, starts_at, ends_at, price) VALUES
  (8, '2026-12-27 04:30:00', '2026-12-27 14:30:00', 34500),
  (8, '2027-01-10 04:30:00', '2027-01-10 14:30:00', 34500),
  (8, '2027-01-30 04:30:00', '2027-01-30 14:30:00', 30000),
  (8, '2026-12-12 04:30:00', '2026-12-12 14:30:00', 30000);
INSERT INTO Venues (venue_id, name, area, latitude, longitude, capacity_stalls, description) VALUES (9, 'Auto Cluster Exhibition Centre', 'Chinchwad', 18.629, 73.7997, 100, 'Purpose-built exhibition centre in Pimpri-Chinchwad.');
INSERT INTO VenueSlots (venue_id, starts_at, ends_at, price) VALUES
  (9, '2027-01-02 04:30:00', '2027-01-02 14:30:00', 80000),
  (9, '2027-01-16 04:30:00', '2027-01-16 14:30:00', 80000),
  (9, '2027-01-31 04:30:00', '2027-01-31 14:30:00', 92000),
  (9, '2026-12-13 04:30:00', '2026-12-13 14:30:00', 92000);
INSERT INTO Venues (venue_id, name, area, latitude, longitude, capacity_stalls, description) VALUES (10, 'Pune International Exhibition & Convention Centre', 'Moshi', 18.6782, 73.8432, 200, 'The largest expo grounds in the region, for big multi-day fairs.');
INSERT INTO VenueSlots (venue_id, starts_at, ends_at, price) VALUES
  (10, '2027-01-03 04:30:00', '2027-01-03 13:30:00', 172500),
  (10, '2027-01-17 04:30:00', '2027-01-17 13:30:00', 172500),
  (10, '2026-12-05 04:30:00', '2026-12-05 13:30:00', 150000),
  (10, '2026-12-19 04:30:00', '2026-12-19 13:30:00', 150000);
