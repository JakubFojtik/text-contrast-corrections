# Description

Sets minimum font width to normal and increases contrast between text and background if 
necessary.
Also changes scrollbar colors to dark on transparent.

Only tested in Greaasemonkey in Firefox.

# Example
Not very visible, but the Issues, Pull requests etc. have more contrast, as do the comments:
![](githubdiff.png)

# Installation

 - Install Greasemonkey or equivalent
 - open the [text-contrast-corrections.user.js](https://github.com/JakubFojtik/text-contrast-corrections/raw/master/text-contrast-corrections.user.js) in browser and accept install prompt from 
Greasemonkey
 - if no install prompt appears, click GM logo, Add new script, then Edit the new script and copy 
the contents of [text-contrast-corrections.user.js](https://github.com/JakubFojtik/text-contrast-corrections/raw/master/text-contrast-corrections.user.js) there

# Configuration

Script hijacks the page http://example.com, and replaces it with configuration for the desired contrast ratio.
So you can set ratio of 1 (100%) to make all text black (or white on dark backgrounds), or 0.5 (50%) to make almost no change to pages.

# Todos

- Some readonly tags like <math> cannot have their style modified, experimentaly gathered at a wikipedia page https:- en.wikipedia.org/wiki/MathML , detect programaticaly
- proper credits for used programs with licenses
- Detect if element background is just an underline or a list item bullet e.g. linear-gradient(90deg,currentColor,currentColor)
- for images, decide if they are big enough for each element, not globaly for image, e.g. list item bullet in case first list is not displayed and has different bgcolor
- consider sprite map bg image, will be bigger than displayed portion, colors will be wrong
- match url like gradient, match exactly with braces in case of multiple bgimgs, compute gradient avg color properly
