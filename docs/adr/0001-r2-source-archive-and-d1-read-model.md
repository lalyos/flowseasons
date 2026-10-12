# R2 source archive and D1 read model

The public results app serves its static HTML frontend through Workers Static Assets; the same BFF Worker handles the public API and reads from D1. Retain every raw result JSON upload in R2 under a timestamped object name, import it into D1, and have a Worker materialize Total standings when source data or administrative corrections change. This keeps public reads fast and preserves the original inputs for re-import.
