#pragma once

#include "C.h"
#include "A.h"

namespace Nmmm {

namespace NlA {

class B :
  public A, 
    public C
 
{
virtual void lala(int i) override;
};

}

}
