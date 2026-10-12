"""No-model tests for exact lyric mapping and invalid worker output."""

import unittest

from align_words import aligned_words, remap_words, sentence_bounds


class MappingTests(unittest.TestCase):
    def test_exact_whitespace_and_repeated_words(self):
        words = [
            {"word": "go", "start": 0, "end": 0.2, "probability": 0.8},
            {"word": " go!", "start": 0.4, "end": 0.8, "probability": 0.3},
        ]
        result = remap_words(" go  go!", [" go  ", "go!"], words, 10)
        self.assertEqual("".join(word["text"] for word in result), " go  go!")
        self.assertEqual(result[1]["start_ms"], 10400)
        self.assertEqual(result[1]["confidence"], 0.3)

    def test_missing_text_is_rejected(self):
        with self.assertRaises(ValueError):
            remap_words(
                "hello world",
                ["hello ", "world"],
                [{"word": "hello", "start": 0, "end": 1}],
            )

    def test_mismatched_original_tokens_rejected(self):
        with self.assertRaises(ValueError):
            remap_words("hello", ["different"], [])

    def test_unicode_unknown_confidence(self):
        result = remap_words(
            "café", ["café"], [{"word": "café", "start": 0.2, "end": 0.4}]
        )
        self.assertEqual(result[0]["start_ms"], 200)
        self.assertIsNone(result[0]["confidence"])


class BoundsTests(unittest.TestCase):
    def test_explicit_zero_end_is_invalid_instead_of_treated_as_missing(self):
        with self.assertRaisesRegex(ValueError, "boundaries"):
            sentence_bounds({"start_ms": 1000, "end_ms": 0}, [{"start_ms": 3000}], 5000)

    def test_missing_end_uses_next_sentence_or_audio_duration(self):
        self.assertEqual(
            sentence_bounds({"start_ms": 1000}, [{"start_ms": 3000}], 5000),
            (1000, 3000),
        )
        self.assertEqual(sentence_bounds({"start_ms": 3000}, [], 5000), (3000, 5000))

    def test_invalid_or_non_integer_bounds_are_skipped(self):
        for start, end in [
            (True, 2000),
            (1000.5, 2000),
            (-1, 2000),
            (2000, 2000),
            (1000, 6000),
        ]:
            with self.assertRaisesRegex(ValueError, "boundaries"):
                sentence_bounds({"start_ms": start, "end_ms": end}, [], 5000)

    def test_no_sentence_result_becomes_a_reviewable_error(self):
        with self.assertRaisesRegex(ValueError, "sentence could not be aligned"):
            aligned_words(None)


if __name__ == "__main__":
    unittest.main()
