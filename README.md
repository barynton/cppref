# cppref README

Visual code C++ refactoring extension

## Features

Virtual methods mock declaration/implementation insertion
File pair(cpp/h) creation

## Requirements

npm
ms-code.cpptools

### 0.0.2
Added file pair(cpp/h) creation feature. By default #pragma once is included in header and '#include "headerName.h"' in cpp.

### 0.0.1

Proof of concept. Currently it's only a proof of concept. Thus I'm investigating the possibilities vs.code estensions. As I see things it's possible.
The main difficulty is the lack of well build-in/provided by additional extension abstract syntax tree. ms-code.cpptools outline provides more or less base info, so with the help of some workarounds it's possible.
