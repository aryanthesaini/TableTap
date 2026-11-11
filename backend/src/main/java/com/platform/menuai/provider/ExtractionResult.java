package com.platform.menuai.provider;

import java.util.List;

public record ExtractionResult(String provider, List<ExtractedItem> items) {}
