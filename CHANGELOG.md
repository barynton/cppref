# Change Log

## 0.1.0
+Added namespace configuration for virtual methods implementation. By default nested namespace in function header is used.
+Implemented change declaration command.
+Implemented multiline function header support.
+Significantly improved virtual methods implementation command: 
    +it can be inserted now in outer namespace
    +original indent is saved
    +override check

## 0.0.2
Added file pair(cpp/h) creation feature. By default #pragma once is included in header and '#include "headerName.h"' in cpp.

## 0.0.1

Proof of concept. Currently it's only a proof of concept. Thus I'm investigating the possibilities vs.code estensions. As I see things it's possible.
The main difficulty is the lack of well build-in/provided by additional extension abstract syntax tree. ms-code.cpptools outline provides more or less base info, so with the help of some workarounds it's possible.