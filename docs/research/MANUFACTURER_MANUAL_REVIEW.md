# Manufacturer manual review: signals and instrument-cluster behavior

Research date: 2026-11-24 (Asia/Kolkata). Status: initial primary-source review, incomplete across manufacturers, models, and subsystems.

## Purpose and evidence boundary

Research warning meanings and published thresholds before implementing sensor-to-cluster rules. Owner manuals establish driver-facing behavior; they do not necessarily publish sensor availability, numerical ECU trigger conditions, debounce periods, or diagnostic interfaces. A warning described in a manual is not proof that its underlying numeric measurement is displayed or accessible.

The existing catalog's ranges, update periods, scenario values, activation thresholds, and clearing thresholds are fictional design choices. None has been validated as an OEM calibration. Numeric trigger values must remain null when not published in the reviewed section. Do not replace missing values with generic battery or engine specifications.

This review uses official manufacturer/distributor material. It does not reproduce full manuals. Search-index excerpts are identified separately from fetched sections. Full coverage of all companies and all manuals has not been achieved.

## Reviewed findings

### Mahindra XUV700: detailed cluster behavior

The [official XUV700 manual](https://mvault-cloudfront.mahindra.com/2025/08/26/Owners-Manuals/XUV700/XUV700-Owners-Manual.html), instrument-cluster sections 3.20.14 and 3.20.26-29, describes charging and oil-pressure lamp behavior across ignition-on and engine-running states. The charging lamp indicates charging/alternator trouble; no voltage trigger is given there. Coolant warning flashes at 113 degrees C and is steady with a buzzer at 115 degrees C. Clearing thresholds are not stated. ESC blinking means intervention; a steady lamp indicates malfunction. DPF, DEF, glow-plug, and water-in-fuel indications need separate diesel capability entries. The URL contains a publication path date, not a confirmed model year. Trim, engine, and precise applicability remain unresolved. These observations cannot be applied to every Mahindra or every diesel vehicle.

### Honda Civic Hatchback 2025: fault states and TPMS behavior

The official [indicator table](https://techinfo.honda.com/rjanisis/pubs/OM/AH/AT402525IOM/enu/details/131271047-3664.html) distinguishes steady emissions warnings from engine-misfire flashing and describes the charging indicator as a system problem, without a voltage cutoff. Its low-fuel entry gives approximately 7.0 L for the applicable configuration; this is not a universal percentage. The [unexpected indicator section](https://techinfo.honda.com/rjanisis/pubs/OM/AH/AT402525IOM/enu/details/131271047-15984.html) distinguishes low tire pressure/calibration conditions from a roughly one-minute blink followed by steady illumination for a TPMS problem. It refers to the doorjamb label for prescribed pressures. Direct section fetches failed during this run; official-domain indexed excerpts were reviewed. These entries remain provisional until the complete applicable section is captured. U.S./Canada equipment distinctions must be preserved.

### Hyundai IONIQ 6, CE1 2024, en_US: SOC messages and an ambiguity

The fetched [EV driving-information section](https://ownersmanual.hyundai.com/full_webhelp/CE1/2024/en_US/topic_kx2_55q_t5b.html) lists a low-battery message below 20% SOC and an immediate-charge/power-limited message below 10%. Elsewhere on the same page, the SOC-indicator text places warning-light display below 10%, while the message table says a light accompanies the below-20% message. Record those as separate statements and mark the lamp activation relationship unresolved. Do not silently choose one. Power limitation may involve low charge/voltage, battery temperature, or drive-system overheating. No pack-voltage warning cutoff is provided in the reviewed section. SOC message thresholds are not a substitute for low-voltage battery thresholds.

### Tesla Model 3: low-voltage health versus traction-battery charge

The fetched [troubleshooting section, en_lt](https://www.tesla.com/ownersmanual/model3/en_lt/GUID-9A3F0F72-71F4-433D-B68B-0A472A9359DF.html) describes alert VCFRONT_a182 in terms of degraded low-voltage battery performance and software-update inhibition; it does not publish a voltage trip point for that alert. The [2017-2023 Model 3 subsystem section, en_US](https://www.tesla.com/ownersmanual/2017_2023_model3/en_us/GUID-E414862C-CFA1-4A0B-9548-BE21C32CAA58.html) is a separate applicability source, not a reason to transfer every alert to every year. Keep low-voltage battery health, high-voltage SOC, and charging faults as separate concepts. The live alert page does not establish exact year/firmware coverage, so applicability needs confirmation before a model-specific mapping.

### Tata Nexon EV: low-voltage charging and cluster variants

The [official Nexon EV manual](https://ev.tatamotors.com/content/dam/tml/ev/pdf/owners-manual/nexon-ev-owner-manual.pdf) identifies itself as revision 04 / July 2025. Official-domain indexed page 124 describes a red low-voltage charging lamp at ignition-on that should clear after start; persistence while running indicates charging trouble. No numeric voltage threshold is given in that excerpt. Contents list 7-inch and 10.25-inch clusters and warnings beginning at printed page 123. Full PDF retrieval failed with a gateway error. These are provisional indexed observations; verify cluster/variant applicability in the full document before promoting a rule.

### Kia: charging-system conditions and hybrid warnings

The official [2023 MQ4KH en_US warning section](https://ownersmanual.kia.com/full_webhelp/MQ4KH/2023/en_US/topics/t00246.html) describes charging-system malfunction and hybrid control/hardware indications. It also describes combined regenerative-braking warnings. The reviewed official indexed text does not give a battery-voltage activation threshold. Model-family code, market, year, and powertrain must be attached to any eventual rule; confirmation of the commercial model/trim and a complete fetch remain pending.

### Ford: extended low-voltage state

The fetched [information-message section](https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G1834957&Uid=G1834956&buildtype=web&countryCode=USA&div=f&languageCode=en&moidRef=G539499&userMarket=USA&vFilteringEnabled=False&variantid=6122), Battery and Charging System, distinguishes a charging service message from feature shedding after an extended low-voltage condition and a low-state-of-charge message. No numeric cutoff or exact duration appears there. Model/year identification could not be confirmed through the linked identification page; quarantine these observations from model-specific rules until resolved.

### Mercedes-Benz: luxury warning documentation, retrieval incomplete

The [2023 GLB manual](https://www.mbusa.com/content/dam/mb-nafta/us/owners/manuals/2023/owners-manuals/MY23%20GLB%20Owners%20Manual.pdf), printed page 417, describes a coolant lamp and an additional tone for excessive temperature. Official indexed text was available, but the full PDF exceeded the retrieval limit. The [C-Class Estate September 2024 engine-warning page](https://www.mercedes-benz.ie/services/manuals/c-class-estate-2024-09-s206-mbux/warning-and-indicator-lamps/engine-2/) has indexed text associating an additional tone with exceeding 120 degrees C, but the fetched page lacked that body text. Keep both as provisional source discoveries. Do not use 120 degrees C as a generic Mercedes or luxury-car limit.

### Maruti Suzuki: applicability must precede extraction

The fetched [official manual portal](https://www.marutisuzuki.com/arena/car-manuals) explicitly warns that equipment and specifications depend on model year, variant, and updates. The selected Swift download returned an audio manual, not the required vehicle manual. An older indexed Swift PDF was discoverable, but its direct fetch did not return the original manual. No Swift numeric thresholds are accepted in this pass. Resolve the correct generation, petrol/CNG version, and manual revision first.

### Toyota and BMW: official starting points, no calibration acceptance

Toyota's [warning-light guide](https://www.toyota.com/owners/warning-lights) supplies general indicator meanings; its [2025 Corolla manual portal](https://www.toyota.com/owners/warranty-owners-manuals/vehicle/corolla/2025) did not expose the selected manual in the fetched page. The candidate Canadian PDF exceeded retrieval size. Hybrid-specific trigger research remains pending.

BMW's [official Check Control explanation](https://faq.bmwusa.com/s/article/Driver-assistance-systems-Intelligent-driving-Check-Control-message-Display-bi0As?language=en_US) describes combined lamps, text, sounds, and stored messages. It is a general FAQ, not an exact vehicle manual or calibration source. Select a year/model-specific manual before extracting thresholds.

## Engineering changes required by the research

These are AutoMate design conclusions drawn from the review, not claims of OEM internals:

1. Keep a manufacturer knowledge catalog separate from executable fictional simulation rules. Manual evidence may inspire a fictional scenario without validating its calibration.
2. Separate physical values, controller-reported fault/status events, and indicator presentation. A battery symbol must not be universally mapped to `voltage < 11.5`.
3. Store `knowledgeBasis` independently of telemetry `source`. A sourced rule still evaluates synthetic telemetry in this product.
4. Add ignition/power states: off, ignition_on, cranking, engine_running, EV_ready, charging. Rules have explicit enable conditions.
5. Add lamp states: off, self_check, steady, flashing, unavailable. Preserve color, chime, displayed message, and any manufacturer-specific flashing semantics.
6. Store fault present, feature active, deliberately disabled, and temporarily unavailable separately. A flashing stability lamp can indicate normal intervention rather than failure.
7. Define sampled value ranges separately from normal operating envelopes and warning thresholds. Context, operating mode, and profile-specific bounds belong with calibration, not universal signal metadata.
8. Add persistence/debounce, severity priority, latching, and clearing conditions only when sourced or explicitly fictional. Unknown OEM values remain null.
9. Store display availability separately from sensor/diagnostic availability. A tire warning alone does not prove per-wheel numeric pressures are available.
10. Keep low-voltage battery, high-voltage pack, hybrid powertrain, key-fob battery, and charge-connector status distinct.

## Database additions to design before implementation

| Record | Required information |
|---|---|
| ManualSource | Stable ID, manufacturer, title, model, market, language, model year or null, revision/date, URL, section/page locator, reviewed date, retrieval status |
| ManualObservation | Source ID, paraphrased meaning, signal/event/indicator type, equipment qualifiers, published numeric condition or null, operating mode, unresolved points |
| CalibrationSet | Profile scope, knowledge basis, activation predicate, time requirement, clear predicate, unit, rationale, source IDs, review status, version |
| IndicatorDefinition | Presentation, flash behavior, sound/message, priority, self-check policy, associated events, applicability |
| CapabilityAssignment | Simulation support, physical-sensor evidence, numeric-display evidence, diagnostic-access evidence, each independently known/unknown |

Missing evidence is not equivalent to missing equipment. Missing model applicability prevents promotion to a model-specific manufacturer rule. All current demo rules remain fictional, even if a number happens to match a published manual.

## Coverage and remaining work

This is a review of selected sections from eleven manufacturers/distributors, with substantial retrieval and applicability gaps; it is not eleven fully reviewed manuals. Fetches succeeded for relevant sections from Mahindra, Hyundai, Tesla, and Ford; several other findings relied on official indexed excerpts or general portals/FAQ pages.

Before claiming a model covered: identify exact manual, review cluster and emergency-warning sections, map equipment qualifiers, record every accepted condition with a locator, resolve contradictory wording, and review the extracted mapping. Repeat for petrol/diesel/hybrid/EV and transmission variants.

Next coverage queue: complete the sources above, then add exact-model manuals for Volkswagen, Skoda, Audi, Renault, Nissan, MG, BYD, Jeep, and Volvo. These manufacturers have not been researched in this pass. No threshold should be inferred across them.

Subsystem queue for each selected model: engine/MIL and misfire; oil pressure/level/temperature/service; coolant; low-voltage electrical; transmission; brakes/ABS/EBD/EPB; EPS; stability/traction; tires; SRS/seatbelts/doors; diesel DPF/DEF/glow-plug/water-in-fuel; high-voltage SOC/temperature/charging/power limitation; ADAS availability; suspension; maintenance. Mark each section reviewed, not applicable, or pending, and distinguish unknown numeric limits from published qualitative behavior.

No application exists yet, so no dashboard behavior or OEM conformance was tested. JSON syntax checks on local design data are not vehicle validation.
