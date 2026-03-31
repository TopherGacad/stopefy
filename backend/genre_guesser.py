"""Lightweight keyword-based genre guesser.

Used as a fallback when audio file metadata or YouTube tags don't provide a genre.
Maps well-known artist names and title keywords to genres.
"""

import re

# Artist name -> genre (lowercase keys)
_ARTIST_GENRE: dict[str, str] = {
    # K-Pop
    "bts": "K-Pop", "blackpink": "K-Pop", "twice": "K-Pop", "stray kids": "K-Pop",
    "aespa": "K-Pop", "itzy": "K-Pop", "enhypen": "K-Pop", "ive": "K-Pop",
    "newjeans": "K-Pop", "le sserafim": "K-Pop", "txt": "K-Pop", "nct": "K-Pop",
    "exo": "K-Pop", "red velvet": "K-Pop", "seventeen": "K-Pop", "ateez": "K-Pop",
    "got7": "K-Pop", "monsta x": "K-Pop", "nct dream": "K-Pop", "nct 127": "K-Pop",
    "g-idle": "K-Pop", "(g)i-dle": "K-Pop", "gidle": "K-Pop", "mamamoo": "K-Pop",
    "psy": "K-Pop", "bigbang": "K-Pop", "2ne1": "K-Pop", "winner": "K-Pop",
    "ikon": "K-Pop", "treasure": "K-Pop", "babymonster": "K-Pop",
    # OPM
    "ben&ben": "OPM", "ben & ben": "OPM", "sb19": "OPM", "moira dela torre": "OPM",
    "december avenue": "OPM", "iv of spades": "OPM", "eraserheads": "OPM",
    "parokya ni edgar": "OPM", "rivermaya": "OPM", "silent sanctuary": "OPM",
    "up dharma down": "OPM", "sud": "OPM", "zack tabudlo": "OPM",
    "arthur nery": "OPM", "juan karlos": "OPM", "adie": "OPM",
    "skusta clee": "OPM", "flow g": "OPM", "ex battalion": "OPM",
    "gloc-9": "OPM", "shanti dope": "OPM", "bini": "OPM",
    "sarah geronimo": "OPM", "gary valenciano": "OPM",
    # Hip-Hop / Rap
    "eminem": "Hip-Hop", "kendrick lamar": "Hip-Hop", "drake": "Hip-Hop",
    "kanye west": "Hip-Hop", "ye": "Hip-Hop", "j. cole": "Hip-Hop",
    "travis scott": "Hip-Hop", "21 savage": "Hip-Hop", "lil baby": "Hip-Hop",
    "future": "Hip-Hop", "lil uzi vert": "Hip-Hop", "playboi carti": "Hip-Hop",
    "metro boomin": "Hip-Hop", "megan thee stallion": "Hip-Hop",
    "nicki minaj": "Hip-Hop", "cardi b": "Hip-Hop", "ice spice": "Hip-Hop",
    "jack harlow": "Hip-Hop", "post malone": "Hip-Hop", "juice wrld": "Hip-Hop",
    "xxxtentacion": "Hip-Hop", "lil nas x": "Hip-Hop", "tyler the creator": "Hip-Hop",
    "asap rocky": "Hip-Hop", "a$ap rocky": "Hip-Hop", "baby keem": "Hip-Hop",
    "gunna": "Hip-Hop", "young thug": "Hip-Hop", "lil wayne": "Hip-Hop",
    "jay-z": "Hip-Hop", "nas": "Hip-Hop", "50 cent": "Hip-Hop",
    # R&B
    "the weeknd": "R&B", "sza": "R&B", "frank ocean": "R&B",
    "daniel caesar": "R&B", "h.e.r.": "R&B", "summer walker": "R&B",
    "bryson tiller": "R&B", "6lack": "R&B", "khalid": "R&B",
    "brent faiyaz": "R&B", "jhene aiko": "R&B", "kehlani": "R&B",
    "usher": "R&B", "chris brown": "R&B", "alicia keys": "R&B",
    "john legend": "R&B", "miguel": "R&B",
    # Pop
    "taylor swift": "Pop", "ariana grande": "Pop", "dua lipa": "Pop",
    "billie eilish": "Pop", "olivia rodrigo": "Pop", "harry styles": "Pop",
    "ed sheeran": "Pop", "justin bieber": "Pop", "selena gomez": "Pop",
    "shawn mendes": "Pop", "camila cabello": "Pop", "doja cat": "Pop",
    "lizzo": "Pop", "charlie puth": "Pop", "bruno mars": "Pop",
    "lady gaga": "Pop", "katy perry": "Pop", "rihanna": "Pop",
    "adele": "Pop", "sam smith": "Pop", "lorde": "Pop",
    "halsey": "Pop", "miley cyrus": "Pop", "sia": "Pop",
    "sabrina carpenter": "Pop", "chappell roan": "Pop", "tate mcrae": "Pop",
    "gracie abrams": "Pop",
    # Rock
    "the beatles": "Rock", "led zeppelin": "Rock", "queen": "Rock",
    "pink floyd": "Rock", "nirvana": "Rock", "foo fighters": "Rock",
    "green day": "Rock", "linkin park": "Rock", "imagine dragons": "Rock",
    "arctic monkeys": "Rock", "radiohead": "Rock", "red hot chili peppers": "Rock",
    "the killers": "Rock", "muse": "Rock", "coldplay": "Rock",
    "u2": "Rock", "the rolling stones": "Rock", "ac/dc": "Rock",
    "guns n' roses": "Rock", "metallica": "Metal", "iron maiden": "Metal",
    "slipknot": "Metal", "avenged sevenfold": "Metal",
    # Electronic / EDM
    "marshmello": "Electronic", "calvin harris": "Electronic",
    "david guetta": "Electronic", "martin garrix": "Electronic",
    "avicii": "Electronic", "deadmau5": "Electronic", "skrillex": "Electronic",
    "tiesto": "Electronic", "zedd": "Electronic", "kygo": "Electronic",
    "alan walker": "Electronic", "illenium": "Electronic", "flume": "Electronic",
    "diplo": "Electronic", "major lazer": "Electronic",
    # Latin
    "bad bunny": "Latin", "j balvin": "Latin", "ozuna": "Latin",
    "daddy yankee": "Latin", "maluma": "Latin", "karol g": "Latin",
    "rauw alejandro": "Latin", "anuel aa": "Latin", "feid": "Latin",
    "shakira": "Latin", "rosalia": "Latin",
    # Jazz
    "miles davis": "Jazz", "john coltrane": "Jazz", "louis armstrong": "Jazz",
    "duke ellington": "Jazz", "ella fitzgerald": "Jazz", "billie holiday": "Jazz",
    "thelonious monk": "Jazz", "charlie parker": "Jazz",
    # Country
    "morgan wallen": "Country", "luke combs": "Country", "chris stapleton": "Country",
    "zach bryan": "Country", "kane brown": "Country", "carrie underwood": "Country",
    "luke bryan": "Country", "jason aldean": "Country",
    # Indie
    "tame impala": "Indie", "mac demarco": "Indie", "clairo": "Indie",
    "phoebe bridgers": "Indie", "boygenius": "Indie", "the 1975": "Indie",
    "glass animals": "Indie", "wallows": "Indie", "still woozy": "Indie",
    "rex orange county": "Indie", "steve lacy": "Indie",
    # Acoustic / Folk
    "bon iver": "Folk", "iron & wine": "Folk", "fleet foxes": "Folk",
    "sufjan stevens": "Folk", "mumford & sons": "Folk",
    # Reggae
    "bob marley": "Reggae", "bob marley & the wailers": "Reggae",
    "damian marley": "Reggae", "sean paul": "Reggae",
    # Classical
    "beethoven": "Classical", "mozart": "Classical", "bach": "Classical",
    "chopin": "Classical", "vivaldi": "Classical", "debussy": "Classical",
}

# Title keyword patterns -> genre
_KEYWORD_PATTERNS: list[tuple[str, str]] = [
    (r"\b(remix|edm|bass drop|dubstep|house mix|techno)\b", "Electronic"),
    (r"\b(acoustic version|acoustic cover|unplugged)\b", "Acoustic"),
    (r"\b(corrido|reggaeton|cumbia|bachata|salsa)\b", "Latin"),
    (r"\b(lofi|lo-fi|lo fi|chillhop)\b", "Electronic"),
]


def guess_genre(title: str, artist: str) -> str | None:
    """Return a best-guess genre string, or None if no guess can be made."""
    artist_lower = artist.strip().lower()

    # Direct artist match
    if artist_lower in _ARTIST_GENRE:
        return _ARTIST_GENRE[artist_lower]

    # Partial artist match (e.g. "BTS feat. Halsey" -> check "bts")
    for known_artist, genre in _ARTIST_GENRE.items():
        if known_artist in artist_lower:
            return genre

    # Title keyword patterns
    combined = f"{title} {artist}".lower()
    for pattern, genre in _KEYWORD_PATTERNS:
        if re.search(pattern, combined, re.IGNORECASE):
            return genre

    return None
