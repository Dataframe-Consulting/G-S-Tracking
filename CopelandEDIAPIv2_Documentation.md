# Copeland EDI API v2 (API Version 1.21)

> Last Updated: 6/2/2025  
> **Copeland Commercial & Residential Solutions — Cargo Solutions**  
> https://www.copeland.com/en-us/products/controls-monitoring-systems/cargo-tracking-monitoring

---

## Table of Contents

1. [Overview](#overview)
2. [Access](#access)
3. [Dates](#dates)
4. [Temperature](#temperature)
5. [Conventions](#conventions)
6. [Authentication](#authentication)
7. [Core API for Real-Time Trackers](#core-api-for-real-time-trackers)
   - [Get Sensor Readings](#get-sensor-readings)
   - [Get Alerts](#get-alerts)
   - [Get Trip Status](#get-trip-status)
   - [Define Trip](#define-trip)
   - [Close Trip](#close-trip)
   - [Cancel Trip](#cancel-trip)
   - [Get Trip End Summary](#get-trip-end-summary)
   - [Update Trip](#update-trip)
   - [Get Available Trackers](#get-available-trackers)

---

## Overview

The Copeland EDI API v2 is a publicly available API interface allowing Copeland customers access to the methods required to perform EDI operations such as launching a trip and retrieving tracker status information.

---

## Access

Authentication requires a **Subscription ID** and an **Api Key**, both provided from Copeland Customer Service. These keys are added to the headers collection of the request being made.

---

## Dates

All dates and times follow the **ISO 8601** standard. Examples:

```
2023-06-18T00:00:00
2024-12-30T17:08:56
2024-08-23T15:46:20
```

All API methods with date and time arguments expect **UTC values**; all returned date/time data will be in UTC as well.

---

## Temperature

All temperature properties passed to or returned from the API are in **°C**.

---

## Conventions

The Copeland EDI API conforms to standard HTTP verbs:

| Verb | Usage |
|------|-------|
| `GET` | Retrieving data from the Oversight system |
| `POST` | Creating new records or performing custom operations |
| `PUT` | Updating existing records |

> In all method definitions, **required fields** are preceded with an asterisk (`*`).

---

## Method Descriptions

Each method is documented with the following sections:

- **Definition** — The URL of the API method
- **Header Fields** — HTTP header fields required by the method
- **Parameters** — HTTP Request Body in JSON format
- **Response** — HTTP Response Body in JSON format
- **Error Codes** — Error codes that may be returned in the Response data
- **Description** — Detailed notes about the method

All specified Header Fields are required in each method call. In the Parameters section, required arguments are identified with an `*asterisk`.

---

## Authentication

A **Subscription ID** and **Api Key** are required for access to all Copeland EDI API methods. Copeland customers may request these keys from Copeland Customer Service.

---

## Core API for Real-Time Trackers

---

### Get Sensor Readings

**DEFINITION:**
```
POST https://api.oversight.copeland.com/edi/GetSensorReadings
```

**HEADER FIELDS:**

| Field | Type | Description |
|-------|------|-------------|
| `*Content-Type` | String | `application/json` |
| `*X-LT-ApiKey` | String | API Key (provided by Copeland) |
| `*Ocp-Apim-Subscription-Key` | String | Subscription Key (provided by Copeland) |

**PARAMETERS — `GetSensorReadingsRequest`:**

| Field | Type | Description |
|-------|------|-------------|
| `PageSize` | Int | 1–1000; defaults to 500 if not provided |
| `LastGUID` | Guid | Optional; GUID of the last sensor reading requested/returned |

**RESPONSE — `GetSensorReadingsResponse`:**

| Field | Type | Description |
|-------|------|-------------|
| `HasMoreResults` | Boolean | Indicates more sensor readings still available for download |
| `MaxGUIDReturned` | Guid | The GUID of the last sensor reading returned |
| `ErrorCode` | Int | |
| `ErrorDescription` | String | |
| `Count` | Int | |

**`GetSensorReadingsResponse` — Sensor Reading Object:**

| Field | Type | Description |
|-------|------|-------------|
| `Guid` | String (50 char max) | Unique identifier for sensor reading |
| `TrackerId` | String (255 char max) | GO unit serial number |
| `DateTimeAcquiredUTC` | String (ISO 8601) | UTC date and time of report |
| `Latitude` | Double | Latitude of tracker at time of reporting |
| `Longitude` | Double | Longitude of tracker at time of reporting |
| `Sensors` | Sensor[] | See Sensor definition below |

**`Sensor` Object:**

| Field | Type | Description |
|-------|------|-------------|
| `SensorId` | String | See SensorId values below |
| `SensorValue` | Double | Sensor value in unit of measure defined for SensorId |
| `BatteryPct` | Int | Tracker battery level (%) |
| `TripId` | String | Trip name provided in DefineTrip |

**SensorId Values:**

| SensorId | Description |
|----------|-------------|
| `G0` | Temperature in °C |
| `PRB` | Probe temperature in °C |
| `HU` | Humidity as % (0–100) |
| `CO2` | Carbon dioxide in PPM (parts per million) |

**ERROR CODES:**

| Code | Description |
|------|-------------|
| `0` | Success |
| `100` | Internal Error |
| `401` | Access denied due to missing subscription key |
| `601280` | RESTAPIKey is required |
| `601281` | The RESTAPIKey provided does not map to a valid CustomerID |
| `601282` | Username does not have access to RESTAPIKey |
| `601283` | Not enough time has elapsed since previous request |
| `601284` | LastGUID is not valid |
| `601285` | LastGUID specified is too old |
| `601286` | PageSize specified is too large |

**DESCRIPTION:**

The `GetSensorReadings` API returns the next batch of sensor readings based on the last batch sent, so subsequent calls will get the next results until all current readings have been returned. The consumer will know additional records exist based on the `HasMoreResults` flag. To get all current readings, continue making calls until `HasMoreResults` is `false`.

- Default page size is **500**; can be set to 1–1,000.
- The `Count` field denotes the number of records returned in each call.
- The first call returns data starting with the oldest record received in the last **24 hours**.
- Optionally use `LastGUID` to pull starting from a specific sensor reading.
- `MaxGUIDReturned` provides the last sensor reading GUID for use as a pagination cursor.

**EXAMPLE REQUEST:**

```http
POST https://api.oversight.copeland.com/edi/GetSensorReadings
Content-Type: application/json
X-LT-ApiKey: 78589B11-8DC3-4BEF-B227-723C566AA87B
Ocp-Apim-Subscription-Key: DFB873DC-69B1-4D6B-8552-E9302A472C40

{"PageSize": 2}
```

**EXAMPLE ERROR RESPONSES:**

```json
{"ErrorCode": 1011, "ErrorDescription": "Error getting sensor Readings: Not enough time has elapsed since previous request."}
{"ErrorCode": null, "ErrorDescription": "Error getting sensor Readings: PageSize specified is too large."}
```

**EXAMPLE SUCCESS RESPONSE:**

```json
{
  "SensorReadings": [
    {
      "Guid": "f8ea2fca-18ba-ee11-aa0e-ad2ba16ff3b6",
      "TrackerId": "1901088888",
      "DateTimeAcquiredUTC": "2024-01-23T17:56:45",
      "Latitude": 26.835396,
      "Longitude": -80.133785,
      "IsinThrottleMinutes": false,
      "Sensors": [{"SensorId": "G0", "SensorValue": 22.62}],
      "BatteryPct": 92
    },
    {
      "Guid": "e15a7143-1bba-ee11-aa0e-ad2ba16ff3b6",
      "TrackerId": "1901088888",
      "DateTimeAcquiredUTC": "2024-01-23T18:02:42",
      "Latitude": 26.835687,
      "Longitude": -80.133778,
      "IsinThrottleMinutes": false,
      "Sensors": [{"SensorId": "G0", "SensorValue": 22.5}],
      "BatteryPct": 92,
      "TripId": "ShipmentA3-9"
    }
  ],
  "HasMoreResults": true,
  "ErrorCode": 0,
  "ErrorDescription": null,
  "Count": 2
}
```

---

### Get Alerts

**DEFINITION:**
```
POST https://api.oversight.copeland.com/edi/GetAlerts
```

**HEADER FIELDS:**

| Field | Type | Description |
|-------|------|-------------|
| `*Content-Type` | String | `application/json` |
| `*X-LT-ApiKey` | String | API Key (provided by Copeland) |
| `*Ocp-Apim-Subscription-Key` | String | Subscription Key (provided by Copeland) |

**PARAMETERS — `GetAlertsRequest`:**

| Field | Type | Description |
|-------|------|-------------|
| `*LastTripStatusSequenceID` | Int | Required |

**RESPONSE — `GetAlertsResponse`:**

| Field | Type | Description |
|-------|------|-------------|
| `ErrorCode` | Int | |
| `ErrorDescription` | String | |
| `Memo` | String | |
| `TripStatusList` | TripStatus[] | See TripStatus definition below |

**`TripStatus` Object:**

| Field | Type | Description |
|-------|------|-------------|
| `TripStatusSequenceID` | Int | Sequential identifier for TripStatus records |
| `TrackerID` | String | GO unit serial number |
| `EMRCustomerID` | Int | Copeland Customer Identifier |
| `LaneDescription` | String | Lane description |
| `Latitude` | Double | Latitude of tracker at time of reporting |
| `Longitude` | Double | Longitude of tracker at time of reporting |
| `DateTimeAcquiredUTC` | String (ISO 8601) | UTC date and time of report |
| `TripID` | String | From DefineTripRequest record |
| `CarrierTcode` | String | Optional customer data, from DefineTripRequest |
| `CustomerCode` | String | Optional customer data, from DefineTripRequest |
| `ShipmentStatusCode` | String | See ShipmentStatusCode values below |
| `StopNumber` | Int | From DefineTripRequest record (-1 if not at a stop) |
| `EventCity` | String | City at time of reporting |
| `EventState` | String | State at time of reporting |
| `EventZip` | String | Zip code at time of reporting |
| `BatteryPct` | Int | Tracker battery level (%) |
| `AlertCode` | Int | See AlertCode values below |
| `AlertID` | Long | Copeland internal alert ID |
| `AlertDesc` | String | Description of alert, if any |
| `AlertValue` | Double | Temperature value, if there is an alert (°C) |
| `AlertThresholdLowCritical` | Double | Temperature range from DefineTripRequest (°C) |
| `AlertThresholdHighCritical` | Double | Temperature range from DefineTripRequest (°C) |
| `Sensors` | Sensor[] | See Sensor definition |
| `PlateNum` | String | Optional plate number, from DefineTripRequest |
| `ContainerNum` | String | Optional container number, from DefineTripRequest |
| `DriverPhone` | String | Optional driver phone number, from DefineTripRequest |
| `ReturnCode` | Int | If included, error code from previous Define Trip request |
| `ExceptionMessage` | String | If included, error description from previous Define Trip request |

**ShipmentStatusCode Values:**

| Code | Description |
|------|-------------|
| `AFO` | Trip Started |
| `X3` | Pick Stop Entered |
| `AF` | Pick Stop Exited |
| `X1D` | Trip Ended |
| `X1` | Delivery Stop Entered |
| `CD` | Delivery Stop Exited |
| `X6` | General Status, No Event |
| `EN` | General Stop Entered |
| `EX` | General Stop Exited |

**AlertCode Values:**

| Code | Description |
|------|-------------|
| `201` | Temperature Alert |
| `416` | Tracker battery below threshold |
| `803` | Tracker entered end location proximity |
| `806` | Tracker entered trip stop proximity |
| `906` | Light detected |
| `909` | Shock detected (default is off) |

**SensorId Values:**

| SensorId | Description |
|----------|-------------|
| `G0` | Temperature in °C |
| `PRB` | Probe temperature in °C |
| `HU` | Humidity as % (0–100) |
| `CO2` | Carbon dioxide in PPM (parts per million) |

**ERROR CODES:**

| Code | Description |
|------|-------------|
| `0` | Success |
| `100` | Internal Error |
| `401` | Access denied due to missing subscription key |
| `1011` | Not enough time has elapsed since previous request |

**DESCRIPTION:**

The `GetAlerts` method requests alerts generated by a tracker.

**EXAMPLE REQUEST:**

```http
POST https://api.oversight.copeland.com/edi/GetAlerts
Content-Type: application/json
X-LT-ApiKey: 78589B11-8DC3-4BEF-B227-723C566AA87B
Ocp-Apim-Subscription-Key: DFB873DC-69B1-4D6B-8552-E9302A472C40

{"LastTripStatusSequenceID": 12345}
```

**EXAMPLE ERROR RESPONSE:**

```json
{"ErrorCode": 1001, "ErrorDescription": "InvalidApiKey"}
```

**EXAMPLE SUCCESS RESPONSE:**

```json
{
  "TripStatusList": [
    {
      "TripStatusSequenceID": 72076754,
      "TrackerID": "T192580225",
      "Latitude": 37.173659879,
      "Longitude": -77.49579359,
      "DeviceTemp": -20.5,
      "DateTimeAcquiredUTC": "2023-06-30T06:45:00",
      "TripID": "MT CM Temp 1 -1",
      "ShipmentStatusCode": "X6",
      "StopNumber": -1,
      "BatteryPct": 100,
      "AlertCode": 201,
      "AlertID": 20001,
      "AlertDesc": "Alert! The temperature is too low. Immediate action is required to prevent damage to your product.",
      "AlertValue": -20.5,
      "AlertThresholdLowCritical": 5,
      "AlertThresholdHighCritical": 95,
      "Sensors": [{"SensorId": "G0", "SensorValue": -20.5}],
      "EMRCustomerID": 19258
    }
  ],
  "ErrorCode": 0,
  "ErrorDescription": null,
  "Memo": null
}
```

---

### Get Trip Status

**DEFINITION:**
```
POST https://api.oversight.copeland.com/edi/GetTripStatus
```

**HEADER FIELDS:**

| Field | Type | Description |
|-------|------|-------------|
| `*Content-Type` | String | `application/json` |
| `*X-LT-ApiKey` | String | API Key (provided by Copeland) |
| `*Ocp-Apim-Subscription-Key` | String | Subscription Key (provided by Copeland) |

**PARAMETERS — `GetTripStatusRequest`:**

| Field | Type | Description |
|-------|------|-------------|
| `*LastTripStatusSequenceID` | Int | Required |

**RESPONSE — `GetTripStatusResponse`:**

| Field | Type | Description |
|-------|------|-------------|
| `ErrorCode` | Int | |
| `ErrorDescription` | String | |
| `TripStatus` | TripStatus[] | See TripStatus definition below |

**`TripStatus` Object:**

| Field | Type | Description |
|-------|------|-------------|
| `TripStatusSequenceID` | Int | Sequential identifier for TripStatus records |
| `TrackerID` | String | GO unit serial number |
| `EMRCustomerID` | Int | Copeland Customer Identifier |
| `LaneDescription` | String | Lane description |
| `Latitude` | Double | Latitude of tracker at time of reporting |
| `Longitude` | Double | Longitude of tracker at time of reporting |
| `DateTimeAcquiredUTC` | String (ISO 8601) | UTC date and time of report |
| `TripID` | String | From DefineTripRequest record |
| `CarrierTcode` | String | Optional customer data, from DefineTripRequest |
| `CustomerCode` | String | Optional customer data, from DefineTripRequest |
| `ShipmentStatusCode` | String | See ShipmentStatusCode values below |
| `StopNumber` | Int | From DefineTripRequest record (-1 if not at a stop) |
| `EventCity` | String | City at time of reporting |
| `EventState` | String | State at time of reporting |
| `EventZip` | String | Zip code at time of reporting |
| `BatteryPct` | Int | Tracker battery level (%) |
| `AlertCode` | Int | See AlertCode values below |
| `AlertID` | Long | Copeland internal alert ID |
| `AlertDesc` | String | Description of alert, if any |
| `AlertValue` | Double | Temperature value, if there is an alert (°C) |
| `AlertThresholdLowCritical` | Double | Temperature range from DefineTripRequest (°C) |
| `AlertThresholdHighCritical` | Double | Temperature range from DefineTripRequest (°C) |
| `Sensors` | Sensor[] | See Sensor definition |
| `PlateNum` | String | Optional plate number, from DefineTripRequest |
| `ContainerNum` | String | Optional container number, from DefineTripRequest |
| `DriverPhone` | String | Optional driver phone number, from DefineTripRequest |
| `ReturnCode` | Int | If included, error code from previous Define Trip request |
| `ExceptionMessage` | String | If included, error description from previous Define Trip request |

**ShipmentStatusCode Values:**

| Code | Description |
|------|-------------|
| `AFO` | Trip Started |
| `X3` | Pick Stop Entered |
| `AF` | Pick Stop Exited |
| `X1D` | Trip Ended |
| `X1` | Delivery Stop Entered |
| `CD` | Delivery Stop Exited |
| `X6` | General Status, No Event |
| `EN` | General Stop Entered |
| `EX` | General Stop Exited |

**AlertCode Values:**

| Code | Description |
|------|-------------|
| `201` | Temperature Alert |
| `803` | Tracker entered end location proximity |
| `806` | Tracker entered trip stop proximity |
| `906` | Light detected |

**SensorId Values:**

| SensorId | Description |
|----------|-------------|
| `G0` | Temperature in °C |
| `PRB` | Probe temperature in °C |
| `HU` | Humidity as % (0–100) |
| `CO2` | Carbon dioxide in PPM (parts per million) |

**ERROR CODES:**

| Code | Description |
|------|-------------|
| `0` | Success |
| `100` | Internal Error |
| `1001` | Invalid apiKey |
| `1003` | Invalid accessToken |
| `1008` | Missing API key |
| `1009` | No matching results |
| `1010` | Invalid parameter |
| `1011` | Not enough time has elapsed since previous request |

**DESCRIPTION:**

The `GetTripStatus` method requests Trip Status data from the Oversight system. The `LastTripStatusSequenceID` value defines the last `TripStatusSequenceID` processed in a previous call, filtering results to only return data accumulated since then.

- **First call:** Set `LastTripStatusSequenceID` to `0` (or `null`) to return ALL Trip Status records for this customer.
- **Subsequent calls:** Use the last `TripStatusSequenceID` received to get only new records.

This call logs both the IP and authorization token used in system log files.

**EXAMPLE REQUEST:**

```http
POST https://api.oversight.copeland.com/edi/GetTripStatus
Content-Type: application/json
X-LT-ApiKey: 78589B11-8DC3-4BEF-B227-723C566AA87B
Ocp-Apim-Subscription-Key: DFB873DC-69B1-4D6B-8552-E9302A472C40

// Last results only:
{"LastTripStatusSequenceID": 12345}

// All results:
{"LastTripStatusSequenceID": null}
```

**EXAMPLE ERROR RESPONSE:**

```json
{"ErrorCode": 1009, "ErrorDescription": "No records found", "TripStatusList": null}
```

**EXAMPLE SUCCESS RESPONSE (Bad Define Trip Requests):**

```json
{
  "ErrorCode": 0,
  "ErrorDescription": null,
  "TripStatusList": [
    {
      "ExceptionMessage": "Cannot change Tracker after Trip start",
      "ReturnCode": 3201,
      "TrackerID": "1200008892",
      "TripID": "MyTrip",
      "TripStatusSequenceID": 27540692
    },
    {
      "ExceptionMessage": "DeviceID is already assigned to another Trip",
      "ReturnCode": 3102,
      "TrackerID": "1200008892",
      "TripID": "MyTrip222",
      "TripStatusSequenceID": 27540693
    }
  ]
}
```

**EXAMPLE SUCCESS RESPONSE:**

```json
{
  "ErrorCode": 0,
  "ErrorDescription": null,
  "TripStatusList": [
    {
      "BatteryPct": 95,
      "DateTimeAcquiredUTC": "2017-10-31T14:01:36",
      "DeviceTemp": 14.6,
      "EventCity": "Charlwood",
      "EventState": "England",
      "EventZip": "RH6",
      "Latitude": 51.15134,
      "Longitude": -0.212221,
      "TrackerID": "8901001423",
      "TripID": "LLAC/8901001423",
      "TripStatusSequenceID": 27498556
    },
    {
      "BatteryPct": 95,
      "DateTimeAcquiredUTC": "2017-10-31T15:13:27",
      "DeviceTemp": 14.4,
      "EventCity": "Bletchingley",
      "EventState": "England",
      "EventZip": "RH9 8ND",
      "Latitude": 51.25153,
      "Longitude": -0.074731,
      "TrackerID": "8901001423",
      "TripID": "LLAC/8901001423",
      "TripStatusSequenceID": 27502648,
      "PlateNum": "ABC123",
      "ContainerNum": "E929",
      "DriverPhone": "(333)444-5555"
    }
  ]
}
```

---

### Define Trip

**DEFINITION:**
```
POST https://api.oversight.copeland.com/edi/DefineTrip
```

**HEADER FIELDS:**

| Field | Type | Description |
|-------|------|-------------|
| `*Content-Type` | String | `application/json` |
| `*X-LT-ApiKey` | String | API Key (provided by Copeland) |
| `*Ocp-Apim-Subscription-Key` | String | Subscription Key (provided by Copeland) |

**PARAMETERS — `DefineTripRequest`:**

| Field | Type | Description |
|-------|------|-------------|
| `*TripID` | String (50 char max) | Unique identifier for this trip/shipment |
| `TripAction` | String (50 char max) | `"cancel"` = cancel trip, else NULL |
| `*TrackerID` | String (50 char max) | GO unit serial number |
| `LaneDescription` | String (255 char max) | Optional lane description |
| `CarrierTcode` | String (50 char max) | Optional customer data |
| `CustomerCode` | String (50 char max) | Optional customer data |
| `TempLowCritical` | Float | Low temperature critical threshold (°C) |
| `TempHighCritical` | Float | High temperature critical threshold (°C) |
| `*Locations` | StopLocation[] | At least two Locations required |
| `RepID` | String (50 char max) | Optional customer data |
| `RepFirstName` | String (100 char max) | Optional customer data |
| `RepLastName` | String (100 char max) | Optional customer data |
| `RepPhone` | String (50 char max) | Optional customer data |
| `RepEmail` | String (250 char max) | Optional customer data |
| `ShipperName` | String (100 char max) | Optional customer data |
| `ReceiverName` | String (100 char max) | Optional customer data |
| `CarrierName` | String (100 char max) | Optional customer data |
| `CarrierEmails` | String[] | Array of email addresses to notify of alerts |
| `ShipperEmails` | String[] | Optional customer data |
| `ReceiverEmails` | String[] | Optional customer data |
| `RetailerID` | String | Optional unique ID of Retailer that will receive a copy of this shipment |
| `DriverName` | String (100 char max) | Optional customer data |
| `DriverPhone` | String (50 char max) | Optional customer data |
| `EstimatedFlightMinutes` | Int | Estimated time traveling by airplane (minutes) |
| `EstimatedLoadingMinutes` | Int | Estimated time to load shipment onto airplane |
| `PlateNum` | String (20 char max) | Optional plate number |
| `ContainerNum` | String (50 char max) | Optional container number |
| `ReceiverPONum` | String (50 char max) | Optional PO number |

**`StopLocation` Object:**

| Field | Type | Description |
|-------|------|-------------|
| `*LocationName` | String (50 char max) | Customer defined location name |
| `*LocationID` | String (50 char max) | Customer defined unique location ID |
| `*Address1` | String (100 char max) | Required |
| `Address2` | String (100 char max) | Optional |
| `*City` | String (50 char max) | Required |
| `*State` | String (50 char max) | Optional |
| `*Zip` | String (50 char max) | Required |
| `*Country` | String (50 char max) | Required |
| `LocationContact` | String (100 char max) | Optional |
| `LocationPhoneNumber` | String (50 char max) | Optional |
| `*LocationType` | String (50 char max) | Must be either `pick` (0) or `delivery` (1) |
| `StopDateUTC` | String (ISO 8601) | For Origin: estimated departure time. For Destination: estimated arrival time. Not used for additional stops. |
| `StopTypeCode` | Int | Airport departure (100) or arrival (101). Only ONE of each per trip. |

**RESPONSE — `TripNotificationResponse`:**

| Field | Type | Description |
|-------|------|-------------|
| `ErrorCode` | Int | |
| `ErrorDescription` | String | |

**ERROR CODES:**

| Code | Description |
|------|-------------|
| `0` | Success |
| `100` | Internal Error |
| `1001` | Invalid apiKey |
| `1004` | Origin and destination Locations must be specified (at least 2 Locations required) |
| `1005` | Missing sensor range values — if specified, at least one high & one low must be provided |
| `1006` | Invalid sensor range values — high values must be greater than low values |
| `1007` | Specified tracker is inactive |
| `1008` | Missing API key |
| `1010` | Invalid parameter |
| `1011` | Not enough time has elapsed since previous request |

**DESCRIPTION:**

The `DefineTrip` method defines a new Trip for processing by the Oversight system and subsequent notifications via `GetTripStatus`.

- **Create a new trip:** Pass a `DefineTripRequest` with a unique `TripID`.
- **Update an existing trip:** Pass the same `TripID` with all original fields plus any updated values.
- **Cancel a trip:** Set `TripAction` to `"cancel"`. No other fields are required.

> **Note on temperature ranges:** You do not have to specify temperature ranges. However, if you specify one, you **MUST** provide both `TempLowCritical` and `TempHighCritical`. All values in °C.

> **Note on stops:** At least two `StopLocations` are required. The first is the Trip Start Location, the last is the Trip End Location. Any additional planned stops must be in sequential order between them.

**EXAMPLE REQUEST:**

```http
POST https://api.oversight.copeland.com/edi/DefineTrip
Content-Type: application/json
X-LT-ApiKey: 78589B11-8DC3-4BEF-B227-723C566AA87B
Ocp-Apim-Subscription-Key: DFB873DC-69B1-4D6B-8552-E9302A472C40
```

```json
{
  "CarrierEmails": [""],
  "CarrierName": "",
  "CarrierTcode": "",
  "CustomerCode": "",
  "DriverName": "",
  "EstimatedFlightMinutes": null,
  "EstimatedLoadingMinutes": null,
  "LaneDescription": null,
  "Locations": [
    {
      "Address1": "5210 Windward Pkwy",
      "Address2": "",
      "City": "Alpharetta",
      "Country": "USA",
      "LocationContact": "",
      "LocationID": "101",
      "LocationName": "Warehouse",
      "LocationPhoneNumber": "",
      "LocationType": 0,
      "State": "GA",
      "StopDateUTC": "2015-12-08T00:00:00",
      "StopTypeCode": null,
      "Zip": "30004"
    },
    {
      "Address1": "330 S Hope St",
      "Address2": "",
      "City": "Los Angeles",
      "Country": "USA",
      "LocationContact": "Joey",
      "LocationID": "223",
      "LocationName": "Store 101",
      "LocationPhoneNumber": "(213) 626-0709",
      "LocationType": 1,
      "State": "CA",
      "StopDateUTC": "2015-12-15T13:00:00",
      "StopTypeCode": null,
      "Zip": "90071"
    }
  ],
  "ReceiverEmails": [""],
  "ReceiverName": "",
  "RepEmail": "John@Smith.com",
  "RepFirstName": "John",
  "RepID": "",
  "RepLastName": "Smith",
  "RepPhone": "555-555-5555",
  "RetailerID": null,
  "ShipperEmails": [""],
  "ShipperName": "",
  "TempHighCritical": 5.5,
  "TempLowCritical": 0.5,
  "TrackerID": "1800884890",
  "TripAction": 0,
  "TripID": "MyTestTrip",
  "PlateNum": "ABC123",
  "ContainerNum": "E929",
  "ReceiverPONum": "RPO",
  "DriverPhone": "(333)444-5555"
}
```

**EXAMPLE ERROR RESPONSE:**

```json
{"ErrorCode": 1007, "ErrorDescription": "DeviceID specified is an inactive Tracker"}
```

**EXAMPLE SUCCESS RESPONSE:**

```json
{"ErrorCode": 0, "ErrorDescription": ""}
```

---

### Close Trip

**DEFINITION:**
```
POST https://api.oversight.copeland.com/edi/CloseTrip
```

**HEADER FIELDS:**

| Field | Type | Description |
|-------|------|-------------|
| `*Content-Type` | String | `application/json` |
| `*X-LT-ApiKey` | String | API Key (provided by Copeland) |
| `*Ocp-Apim-Subscription-Key` | String | Subscription Key (provided by Copeland) |

**PARAMETERS — `CloseTripRequest`:**

| Field | Type | Description |
|-------|------|-------------|
| `*TripID` | String (50 char max) | Unique identifier for this trip/shipment |
| `*TrackerID` | String (50 char max) | GO unit serial number |
| `EndTripDateTimeUTC` | String (ISO 8601) | If included, time that the trip ended |

**RESPONSE — `ErrorResponse`:**

| Field | Type | Description |
|-------|------|-------------|
| `ErrorCode` | Int | |
| `ErrorDescription` | String | |

**ERROR CODES:**

| Code | Description |
|------|-------------|
| `0` | Success |
| `100` | Internal Error |
| `1001` | Invalid apiKey |
| `2001` | TrackerID specified does not exist as a Tracker |
| `2002` | TrackerID specified is an inactive Tracker |
| `2003` | TrackerID specified exists, but has never been assigned to a customer |
| `2020` | EndTripDateTimeUTC cannot be in the future |
| `9002` | Trip does not exist |

**DESCRIPTION:**

The `CloseTrip` method forces a trip, previously defined by a call to `DefineTrip`, to end.

**EXAMPLE REQUEST:**

```http
POST https://api.oversight.copeland.com/edi/CloseTrip
Content-Type: application/json
X-LT-ApiKey: 78589B11-8DC3-4BEF-B227-723C566AA87B
Ocp-Apim-Subscription-Key: DFB873DC-69B1-4D6B-8552-E9302A472C40

{"TrackerID": "2000017125", "TripID": "MyTrip"}
```

**EXAMPLE ERROR RESPONSE:**

```json
{"ErrorCode": -1, "ErrorDescription": "DeviceID specified is an inactive Tracker"}
```

**EXAMPLE SUCCESS RESPONSE:**

```json
{"ERRORCODE": 0, "ERRORDESCRIPTION": ""}
```

---

### Cancel Trip

**DEFINITION:**
```
POST https://api.oversight.copeland.com/edi/CancelTrip
```

**HEADER FIELDS:**

| Field | Type | Description |
|-------|------|-------------|
| `*Content-Type` | String | `application/json` |
| `*X-LT-ApiKey` | String | API Key (provided by Copeland) |
| `*Ocp-Apim-Subscription-Key` | String | Subscription Key (provided by Copeland) |

**PARAMETERS — `CancelTripRequest`:**

| Field | Type | Description |
|-------|------|-------------|
| `*TripID` | String (50 char max) | Unique identifier for this trip/shipment |
| `*TrackerID` | String (50 char max) | GO unit serial number |

**RESPONSE — `ErrorResponse`:**

| Field | Type | Description |
|-------|------|-------------|
| `ErrorCode` | Int | |
| `ErrorDescription` | String | |

**ERROR CODES:**

| Code | Description |
|------|-------------|
| `0` | Success |
| `100` | Internal Error |
| `1001` | Invalid apiKey |
| `2001` | TrackerID specified does not exist as a Tracker |
| `2002` | TrackerID specified is an inactive Tracker |
| `2003` | TrackerID specified exists, but has never been assigned to a customer |
| `9002` | Trip does not exist |

**DESCRIPTION:**

The `CancelTrip` method forces a trip, previously defined by a call to `DefineTrip`, to end.

**EXAMPLE REQUEST:**

```http
POST https://api.oversight.copeland.com/edi/CancelTrip
Content-Type: application/json
X-LT-ApiKey: 78589B11-8DC3-4BEF-B227-723C566AA87B
Ocp-Apim-Subscription-Key: DFB873DC-69B1-4D6B-8552-E9302A472C40

{"TrackerID": "2000017125", "TripID": "MyTrip"}
```

**EXAMPLE ERROR RESPONSE:**

```json
{"ErrorCode": -1, "ErrorDescription": "DeviceID specified is an inactive Tracker"}
```

**EXAMPLE SUCCESS RESPONSE:**

```json
{"ERRORCODE": 0, "ERRORDESCRIPTION": ""}
```

---

### Get Trip End Summary

**DEFINITION:**
```
POST https://api.oversight.copeland.com/edi/GetTripEndSummary
```

**HEADER FIELDS:**

| Field | Type | Description |
|-------|------|-------------|
| `*Content-Type` | String | `application/json` |
| `*X-LT-ApiKey` | String | API Key (provided by Copeland) |
| `*Ocp-Apim-Subscription-Key` | String | Subscription Key (provided by Copeland) |

**PARAMETERS — `GetTripEndSummaryRequest`:**

| Field | Type | Description |
|-------|------|-------------|
| `*From` | String (ISO 8601) | UTC period start. Time trip completed or time marked completed. |
| `*Thru` | String (ISO 8601) | UTC period end. Period must not exceed 24 hours. |

**RESPONSE — `GetTripEndSummaryResponse`:**

| Field | Type | Description |
|-------|------|-------------|
| `ErrorCode` | Int | |
| `ErrorDescription` | String | |
| `TripEndSummary` | TripEndSummary[] | See TripEndSummary definition below |
| `ResultsTruncated` | Bool | True if number of trackers in specified date range exceed the per-call limit |
| `TotalTrackers` | Int | Total number of trackers in specified date range |
| `Memo` | String | Not implemented |

**`TripEndSummary` Object:**

| Field | Type | Description |
|-------|------|-------------|
| `CustomerCode` | String | From DefineTripRequest |
| `TripID` | String | From DefineTripRequest |
| `TrackerID` | String | GO unit serial number |
| `MKT` | Double | Mean Kinetic Temperature °C |
| `SensorStandardDeviation` | Double | Sensor standard deviation |
| `CarrierName` | String | From DefineTripRequest |
| `ActualTripStart` | String (ISO 8601) | UTC actual trip start time |
| `ActualTripEnd` | String (ISO 8601) | UTC actual trip end time |
| `TripStateChanged` | String (ISO 8601) | UTC time trip ended or time marked completed |
| `OriginAddress` | String | Origin address |
| `OriginCity` | String | Origin city |
| `OriginState` | String | Origin state |
| `OriginCountry` | String | Origin country |
| `DestinationAddress` | String | Destination address |
| `DestinationCity` | String | Destination city |
| `DestinationState` | String | Destination state |
| `DestinationCountry` | String | Destination country |
| `MaxSensorValue` | Double | Maximum sensor value °C |
| `MinSensorValue` | Double | Minimum sensor value °C |
| `LowCriticalAlertCount` | Int | Number of low critical alerts |
| `LowWarningAlertCount` | Int | Number of low warning alerts |
| `HighWarningAlertCount` | Int | Number of high warning alerts |
| `HighCriticalAlertCount` | Int | Number of high critical alerts |
| `TotalTemperatureAlertCount` | Int | Number of all temperature alerts |
| `ScheduledStartTime` | String (ISO 8601) | UTC scheduled trip start time |
| `ScheduledEndTime` | String (ISO 8601) | UTC scheduled trip end time |

**ERROR CODES:**

| Code | Description |
|------|-------------|
| `0` | Success |
| `50000` | Internal Error |
| `50002` | API key is required |
| `50003` | The API key provided does not map to a valid CustomerID |
| `50004` | From and Thru are required |
| `50005` | Invalid Date range specified |
| `50006` | Date range specified exceeds maximum allowed days |
| `50007` | Not enough time has elapsed since previous request |
| `51000` | Error getting Trip data |

**DESCRIPTION:**

The `GetTripEndSummary` API is intended to be called on a rolling basis (e.g. once per day or every few hours). For each call, `From` should be the `Thru` of the previous call to retrieve all newly completed trips with no gaps. Returns summaries of all trips that completed (`ActualTripEnd`) or were marked as completed (`TripStateChanged`) in the specified period.

> **Note:** Tracker data does not always transmit in real-time (e.g. no cell service). `TripStateChanged` is used to return trips marked as completed in the selected date range, even if `ActualTripEnd` was before the requested range.

> **Limits:** An error is returned if called too frequently, or if the period from `From` to `Thru` exceeds **24 hours**.

**EXAMPLE REQUEST:**

```http
POST https://api.oversight.copeland.com/edi/GetTripEndSummary
Content-Type: application/json
X-LT-ApiKey: 78589B11-8DC3-4BEF-B227-723C566AA87B
Ocp-Apim-Subscription-Key: DFB873DC-69B1-4D6B-8552-E9302A472C40

{"From": "2020-12-01T00:00:00", "Thru": "2020-12-01T02:00:00"}
```

**EXAMPLE ERROR RESPONSE:**

```json
{"ErrorCode": 1009, "ErrorDescription": "No records found", "TripEndSummary": null}
```

**EXAMPLE SUCCESS RESPONSE:**

```json
{
  "TripEndSummaryList": [
    {
      "CustomerCode": null,
      "TripID": "Test trip 36",
      "TrackerID": "4800030217",
      "MKT": null,
      "SensorStandardDeviation": null,
      "CarrierName": "",
      "ActualTripStart": "2017-09-27T13:38:11",
      "ActualTripEnd": "2020-07-17T19:06:27",
      "TripStateChanged": "2020-07-17T19:06:27",
      "ScheduledStartTime": "2018-03-15T05:09:00",
      "ScheduledEndTime": "2018-03-31T05:10:00"
    }
  ],
  "ResultsTruncated": false,
  "TotalTrackers": 1,
  "ErrorCode": 0,
  "ErrorDescription": null,
  "Memo": null
}
```

---

### Update Trip

**DEFINITION:**
```
POST https://api.oversight.copeland.com/edi/UpdateTrip
```

**HEADER FIELDS:**

| Field | Type | Description |
|-------|------|-------------|
| `*Content-Type` | String | `application/json` |
| `*X-LT-ApiKey` | String | API Key (provided by Copeland) |
| `*Ocp-Apim-Subscription-Key` | String | Subscription Key (provided by Copeland) |

**PARAMETERS — `UpdateTripRequest`:**

| Field | Type | Description |
|-------|------|-------------|
| `*TrackerID` | String (ISO 8601) | GlobalDeviceID |
| `*TripName` | String (ISO 8601) | Trip name |
| `*CustomerIDTracker` | Int | Customer ID tracker belongs to |
| `*RESTApiKey` | String (ISO 8601) | REST API key [this or CustomerID required] |

**RESPONSE — `UpdateTripResponse`:**

| Field | Type | Description |
|-------|------|-------------|
| `ErrorCode` | Int | |
| `ErrorDescription` | String | |
| `TripName` | String | Updated trip name |

**ERROR CODES:**

| Code | Description |
|------|-------------|
| `0` | Success |
| `100` | Internal Error |
| `50001` | You must provide `@RESTAPIKey` or `@CustomerID` |
| `50002` | Can only specify either CustomerID OR RESTAPIKey |
| `50003` | The RESTAPIKey provided does not map to a valid CustomerID |
| `50004` | Sent-from Customer is not EDIEnabled |
| `50006` | Username is required |
| `50007` | TrackerID is required |
| `50008` | TripName is required |
| `50009` | CustomerIDTracker is required |
| `50010` | CustomerIDTracker does not map to a valid Customer |
| `50011` | TrackerID does not exist as a Tracker |
| `50013` | TrackerID does not have an active customer assignment |
| `50014` | TrackerID does not map to the CustomerIDTracker specified |
| `50015` | Customer does not have permission to update trips for the Tracker's Customer |

**DESCRIPTION:**

The `UpdateTrip` API is intended to be called when the trip name needs to be updated on an as-needed basis. The original trip name is appended to the trip description field (prefixed with `|OldName=`) and the trip name is replaced with the new value.

Both `CustomerIDTracker` and `RESTAPIKey` refer to the customer who owns the tracker. Contact your account representative to obtain a `RESTAPIKey` for any customer sites you wish to update trackers for.

**EXAMPLE REQUEST:**

```http
POST https://api.oversight.copeland.com/edi/UpdateTrip
Content-Type: application/json
X-LT-ApiKey: 78589B11-8DC3-4BEF-B227-723C566AA87B
Ocp-Apim-Subscription-Key: DFB873DC-69B1-4D6B-8552-E9302A472C40

{
  "CustomerIDTracker": 11671,
  "RestApiKey": "90ABE92D-66A7-49BF-AEBC-0ED8C737FD73",
  "TrackerID": "1801234772-11671",
  "TripName": "Update#5"
}
```

**EXAMPLE ERROR RESPONSE:**

```json
{"ErrorCode": 50015, "ErrorDescription": "Customer does not have permission to update trips for the Tracker's Customer", "TripName": null}
```

**EXAMPLE SUCCESS RESPONSE:**

```json
{"TripName": "Update#5", "ErrorCode": 0, "ErrorDescription": null}
```

---

### Get Available Trackers

**DEFINITION:**
```
POST https://api.oversight.copeland.com/edi/GetAvailableTrackers
```

**HEADER FIELDS:**

| Field | Type | Description |
|-------|------|-------------|
| `*Content-Type` | String | `application/json` |
| `*X-LT-ApiKey` | String | API Key (provided by Copeland) |
| `*Ocp-Apim-Subscription-Key` | String | Subscription Key (provided by Copeland) |

**PARAMETERS — `GetAvailableTrackersRequest`:**

| Field | Type | Description |
|-------|------|-------------|
| `*CustomerID` | Int | Customer ID trackers are assigned to |

**RESPONSE — `GetAvailableTrackersResponse`:**

| Field | Type | Description |
|-------|------|-------------|
| `ErrorCode` | Int | |
| `ErrorDescription` | String | |
| `AvailableTrackers` | AvailableTrackers[] | Collection of trackers (see below) |

**`AvailableTracker` Object:**

| Field | Type | Description |
|-------|------|-------------|
| `TrackerSerialNumber` | String | ID used to identify the tracker |
| `GroupName` | String | User-friendly name for the group the tracker belongs to |
| `GroupID` | Int | ID identifying the Group |

**Group Classifications:**

| GroupID | GroupName |
|---------|-----------|
| `101` | MultiTrip Serial #s |
| `102` | Inactive Serial #s |
| `103` | Active Serial #s without a trip assigned |

**ERROR CODES:**

| Code | Description |
|------|-------------|
| `0` | Success |
| `100` | Internal Error |
| `1010` | Customer ID required |
| `1011` | User does not have permissions to view trackers for this customer |

**DESCRIPTION:**

The `GetAvailableTrackers` API is intended to be called when a user needs to know the trackers available for shipment creation prior to calling `DefineTrip`. The user must have permissions to view trackers for the provided `CustomerID`.

**EXAMPLE REQUEST:**

```http
POST https://api.oversight.copeland.com/edi/GetAvailableTrackers
Content-Type: application/json
X-LT-ApiKey: 78589B11-8DC3-4BEF-B227-723C566AA87B
Ocp-Apim-Subscription-Key: DFB873DC-69B1-4D6B-8552-E9302A472C40

{"CustomerID": 10073}
```

**EXAMPLE ERROR RESPONSE:**

```json
{"ErrorCode": 1011, "ErrorDescription": "User does not have permissions to view trackers for this customer"}
```

**EXAMPLE SUCCESS RESPONSE:**

```json
{
  "AvailableTrackers": [
    {"TrackerSerialNumber": "1000338713", "GroupName": "MultiTrip Serial #s", "GroupID": 101},
    {"TrackerSerialNumber": "1201142211", "GroupName": "Active Serial #s without a trip assigned", "GroupID": 103}
  ],
  "ErrorCode": 0,
  "ErrorDescription": null
}
```
